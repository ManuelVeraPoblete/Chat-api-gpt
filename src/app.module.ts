// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';

import { PrismaModule } from './modules/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';

// ✅ NUEVO: módulo de logs (HTTP + archivos + Prisma)
import { LoggingModule } from './common/logging/logging.module';

// ✅ NUEVO: módulo de geolocalización
import { LocationsModule } from './modules/locations/locations.module';

// ✅ NUEVO: módulo de llamadas (audio / video)
import { CallsModule } from './modules/calls/calls.module';

/**
 * ✅ AppModule
 * - Config global (.env + validación)
 * - Mongo (Mongoose)
 * - Prisma (MySQL)
 * - Módulos de negocio
 *
 * Importante:
 * - LoggingModule debe cargarse antes que PrismaModule
 *   porque PrismaService ahora inyecta APP_LOGGER.
 */
@Module({
  imports: [
    /**
     * ✅ Variables de entorno globales
     * - `envFilePath`: carga tu `.env`
     * - `load`: configuración tipada (configuration.ts)
     * - `validate`: validación de variables (env.validation.ts)
     */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [configuration],
      validate: validateEnv,
    }),

    /**
     * ✅ Logging Global
     * - Registra HTTP request/response
     * - Escribe en consola + archivo
     * - Provee APP_LOGGER (pino)
     */
    LoggingModule,

    /**
     * ✅ MongoDB para guardar conversaciones y geolocalización
     * Se lee desde MONGO_URI en tu .env
     */
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mongoUri = config.get<string>('MONGO_URI');

        // ✅ Falla rápido si falta la variable
        if (!mongoUri) {
          throw new Error('❌ Falta la variable MONGO_URI en el .env');
        }

        return { uri: mongoUri };
      },
    }),

    /**
     * ✅ Prisma (MySQL)
     * PrismaModule es Global, pero lo importamos por claridad.
     * Importante: LoggingModule ya está arriba para que APP_LOGGER exista.
     */
    PrismaModule,

    // ✅ Módulos del negocio
    UsersModule,
    AuthModule,
    ChatModule,

    // ✅ Geolocalización
    LocationsModule,

    // ✅ Señalización para llamadas (WebRTC)
    CallsModule,
  ],
})
export class AppModule {}
