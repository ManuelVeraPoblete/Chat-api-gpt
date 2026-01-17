import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';

import { PrismaModule } from './modules/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';

// ✅ NUEVO: módulo de chat (lo creamos en el siguiente paso)
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    /**
     * ✅ Variables de entorno globales
     * Mantienes tu validación actual (validateEnv).
     */
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),

    /**
     * ✅ MongoDB para guardar conversaciones
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

        return {
          uri: mongoUri,
        };
      },
    }),

    // ✅ Módulos actuales (no se tocan)
    PrismaModule,
    UsersModule,
    AuthModule,

    // ✅ NUEVO: Chat (lo implementamos ahora)
    ChatModule,
  ],
})
export class AppModule {}
