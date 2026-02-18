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

import { LoggingModule } from './common/logging/logging.module';

import { LocationsModule } from './modules/locations/locations.module';
import { CallsModule } from './modules/calls/calls.module';
import { WorkdayModule } from './modules/workday/workday.module';

// ✅ NUEVO: módulo admin (logs)
import { AdminModule } from './modules/admin/admin.module';

/**
 * AppModule
 * - Config global (.env + validación)
 * - Mongo (Mongoose)
 * - Prisma (MySQL)
 * - Módulos de negocio
 *
 * Importante:
 * - LoggingModule debe cargarse antes que PrismaModule
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [configuration],
      validate: validateEnv,
    }),

    LoggingModule,

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mongoUri = config.get<string>('MONGO_URI');
        if (!mongoUri) {
          throw new Error(' Falta la variable MONGO_URI en el .env');
        }
        return { uri: mongoUri };
      },
    }),

    PrismaModule,

    // Negocio
    UsersModule,
    AuthModule,
    ChatModule,

    LocationsModule,
    CallsModule,
    WorkdayModule,

    // ✅ Admin
    AdminModule,
  ],
})
export class AppModule {}
