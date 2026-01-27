import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';

import { PrismaModule } from './modules/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';

// ✅ NUEVO: módulo de geolocalización
import { LocationsModule } from './modules/locations/locations.module';

@Module({
  imports: [
    /**
     * ✅ Variables de entorno globales
     * - `envFilePath`: se asegura de cargar tu `.env`
     * - `load`: carga configuración tipada (tu archivo configuration.ts)
     * - `validate`: valida variables (tu env.validation.ts)
     */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [configuration],
      validate: validateEnv,
    }),

    /**
     * ✅ MongoDB para guardar conversaciones y ahora también geolocalización
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

    /**
     * ✅ Prisma (MySQL)
     * PrismaModule es Global, pero lo dejamos importado aquí por claridad.
     */
    PrismaModule,

    // ✅ Módulos del negocio
    UsersModule,
    AuthModule,
    ChatModule,

    // ✅ NUEVO: geolocalización de usuarios conectados
    LocationsModule,
  ],
})
export class AppModule {}
