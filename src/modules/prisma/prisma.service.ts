import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

// ✅ PrismaClient ahora se importa desde el output generado
import { PrismaClient } from '../../generated/prisma/client';

// ✅ Adapter requerido en Prisma 7
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/**
 * PrismaService encapsula PrismaClient.
 * Prisma 7:
 * - Debes pasar adapter (o accelerateUrl) al constructor.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // ✅ Adapter usando la misma DATABASE_URL
    const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);

    super({
      adapter,
      log: ['info', 'warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
