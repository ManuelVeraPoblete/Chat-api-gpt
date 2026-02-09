// src/modules/calls/calls.module.ts
import { Module } from '@nestjs/common';
import { CallsGateway } from './calls.gateway';
import { AppJwtModule } from '../../common/jwt/app-jwt.module';

/**
 *  CallsModule
 * - Contiene el Gateway de signaling para llamadas (audio/video)
 * - NO transmite media (solo señalización WebRTC)
 *
 * Importante:
 * - CallsGateway requiere JwtService (para autenticar sockets)
 * - JwtService lo entrega AppJwtModule (que exporta JwtModule)
 */
@Module({
  imports: [
    //  Habilita JwtService en el contexto del módulo
    AppJwtModule,
  ],
  providers: [CallsGateway],
})
export class CallsModule {}
