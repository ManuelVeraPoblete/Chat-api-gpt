import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CryptoUtil } from 'src/common/util/crypto.util';
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

  async register(email: string, displayName: string, password: string) {
    const passwordHash = await CryptoUtil.hash(password, this.saltRounds);
    const user = await this.users.createUser({ email, displayName, passwordHash });

    const tokens = await this.issueTokens(user.id, user.email);
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      ...tokens,
    };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await CryptoUtil.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.issueTokens(user.id, user.email);
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      ...tokens,
    };
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
    const tokens = await this.issueTokens(user.id, user.email);
    await this.storeRefreshTokenHash(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string) {
    // Invalida refresh token
    await this.users.updateRefreshTokenHash(userId, null);
    return { ok: true };
  }

  private async issueTokens(userId: string, email: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.accessTtl,
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.refreshTtl,
      },
    );

    return { accessToken, refreshToken };
  }

  private async storeRefreshTokenHash(userId: string, refreshToken: string) {
    const refreshTokenHash = await CryptoUtil.hash(refreshToken, this.saltRounds);
    await this.users.updateRefreshTokenHash(userId, refreshTokenHash);
  }

  private async verifyRefreshToken(token: string): Promise<{ sub: string; email: string }> {
    try {
      return await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
