// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';
import { AppJwtModule } from '../../common/jwt/app-jwt.module';

/**
 *  AuthModule
 * - Login, refresh, registro
 * - Strategies JWT/Refresh
 *
 * Importante:
 * - JwtService se obtiene desde AppJwtModule (módulo compartido)
 */
@Module({
  imports: [
    UsersModule,
    PassportModule,

    //  Reemplaza JwtModule.register({}) por el módulo compartido
    AppJwtModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshStrategy],
})
export class AuthModule {}
