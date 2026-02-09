// src/common/jwt/app-jwt.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

/**
 *  AppJwtModule (módulo compartido)
 * - Provee JwtService a cualquier módulo que lo necesite.
 * - Centraliza la configuración para evitar duplicar JwtModule.register({}) por todo el proyecto.
 *
 * Nota:
 * - Los "secrets" se siguen pasando dinámicamente donde corresponde (ej: verifyAsync con { secret }).
 */
@Module({
  imports: [
    //  No seteamos secret aquí para mantenerlo dinámico (tu patrón actual).
    JwtModule.register({}),
  ],
  exports: [
    //  Exportamos JwtModule para que otros módulos obtengan JwtService
    JwtModule,
  ],
})
export class AppJwtModule {}
