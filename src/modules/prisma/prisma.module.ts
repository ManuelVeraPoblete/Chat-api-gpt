import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * ✅ PrismaModule
 * - Global: PrismaService estará disponible en cualquier módulo
 *   sin tener que importarlo en todos.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
