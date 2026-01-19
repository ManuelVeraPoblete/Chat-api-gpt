import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';

/**
 * AuthController
 * - Endpoints de autenticación (register/login/refresh/logout/me)
 * - Mantiene el controller delgado (sin lógica de negocio)
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * ✅ Registro de usuario
   * - Se envía el DTO completo al AuthService
   * - Evitamos armar objetos manualmente (Clean Code)
   */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    // ✅ FIX: AuthService.register(dto) recibe 1 argumento (objeto)
    return this.auth.register(dto);
  }

  /**
   * ✅ Login
   * - Retorna accessToken + refreshToken
   */
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  /**
   * ✅ Refresh token via body (no cookies).
   * Guard valida que venga refreshToken.
   */
  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  /**
   * ✅ Logout (invalida refresh token en BD)
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() req: any) {
    return this.auth.logout(req.user.userId);
  }

  /**
   * ✅ Perfil del usuario autenticado
   * - Retorna datos completos desde BD
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return this.auth.me(req.user.userId);
  }
}
