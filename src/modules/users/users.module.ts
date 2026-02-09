import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * UsersModule
 * - Registra controller + service de usuarios
 * - Importa PrismaModule para usar PrismaService
 */
@Module({
  imports: [
    PrismaModule, //  asegura PrismaService disponible
  ],
  controllers: [
    UsersController, //  si esto no está, /users no existe (404)
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
