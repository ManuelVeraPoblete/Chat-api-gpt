import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CryptoUtil } from 'src/common/util/crypto.util';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from '@prisma/client';

/**
 * AuthService: casos de uso de autenticación.
 * SRP: emitir tokens, validar credenciales, refresh/logout.
 */
@Injectable()
export class AuthService {
  private readonly saltRounds: number;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.saltRounds = Number(this.config.get<number>('security.bcryptSaltRounds'));
    this.accessTtl = Number(this.config.get<number>('jwt.accessTtlSeconds'));
    this.refreshTtl = Number(this.config.get<number>('jwt.refreshTtlSeconds'));
  }

  /**
   * Overloads (compatibilidad)
   * - register(dto)  nuevo recomendado
   * - register(email, displayName, password)  legacy
   */
  async register(dto: RegisterDto): Promise<any>;
  async register(email: string, displayName: string, password: string): Promise<any>;

  /**
   * Implementación única
   * - Normaliza argumentos a un DTO
   * - Hashea password
   * - Crea usuario con campos corporativos
   * - Emite tokens y guarda refreshTokenHash
   * - Devuelve perfil público
   *
   * Nota de seguridad:
   * - NO se permite registrar ADMIN desde el endpoint.
   * - ADMIN se crea por bootstrap/seed y se gestiona por TI.
   */
  async register(arg1: RegisterDto | string, displayName?: string, password?: string) {
    // Normalizamos: si viene string => legacy, si viene objeto => DTO moderno
    const dto: RegisterDto =
      typeof arg1 === 'string'
        ? ({
            email: arg1,
            displayName: displayName!,
            password: password!,
          } as RegisterDto)
        : arg1;

    // Hash password
    const passwordHash = await CryptoUtil.hash(dto.password, this.saltRounds);

    // Crea usuario (por defecto USER)
    const user = await this.users.createUser({
      email: dto.email,
      displayName: dto.displayName,
      passwordHash,

      // Campos corporativos (si existen en tu modelo)
      phone: dto.phone ?? null,
      companySection: dto.companySection ?? null,
      jobTitle: dto.jobTitle ?? null,

      // ✅ Rol fijo (seguridad)
      role: UserRole.USER,
    });

    // ✅ Tokens incluyen role
    const tokens = await this.issueTokens(user.id, user.email, user.role);

    // Guardamos refresh token hasheado (rotación)
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    // devolvemos perfil público
    const publicUser = await this.users.findPublicById(user.id);

    return {
      user: publicUser,
      ...tokens,
    };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await CryptoUtil.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    // ✅ Tokens incluyen role
    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    // devolvemos perfil público completo
    const publicUser = await this.users.findPublicById(user.id);

    return {
      user: publicUser,
      ...tokens,
    };
  }

  /**
   * Perfil del usuario logeado
   */
  async me(userId: string) {
    return this.users.findPublicById(userId);
  }

  async refresh(refreshToken: string) {
    // 1) Verificamos firma del refresh token
    const payload = await this.verifyRefreshToken(refreshToken);

    // 2) Confirmamos que el refresh token coincide con el último guardado (hash)
    const user = await this.users.findById(payload.sub);
    if (!user.refreshTokenHash) throw new UnauthorizedException('Refresh token revoked');

    const matches = await CryptoUtil.compare(refreshToken, user.refreshTokenHash);
    if (!matches) throw new UnauthorizedException('Refresh token revoked');

    // 3) Emitimos nuevos tokens + rotación refresh
    // ✅ Tokens incluyen role actual del usuario (desde BD)
    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string) {
    // Invalida refresh token
    await this.users.updateRefreshTokenHash(userId, null);
    return { ok: true };
  }

  /**
   * Access + Refresh tokens
   * ✅ Incluye role en payload para poder proteger /admin/* por rol
   */
  private async issueTokens(userId: string, email: string, role: UserRole) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.accessTtl, // segundos
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, email, role },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.refreshTtl, // segundos
      },
    );

    return { accessToken, refreshToken };
  }

  /**
   * Guarda el refresh token hasheado para poder revocarlo/rotarlo
   */
  private async storeRefreshTokenHash(userId: string, refreshToken: string) {
    const refreshTokenHash = await CryptoUtil.hash(refreshToken, this.saltRounds);
    await this.users.updateRefreshTokenHash(userId, refreshTokenHash);
  }

  /**
   * Verifica firma y expiración del refresh token
   * ✅ Incluye role por consistencia (aunque el refresh luego se valida contra BD)
   */
  private async verifyRefreshToken(token: string): Promise<{ sub: string; email: string; role?: UserRole }> {
    try {
      return await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
