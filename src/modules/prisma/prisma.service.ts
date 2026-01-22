// src/modules/prisma/prisma.service.ts

import 'dotenv/config';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/**
 * ✅ PrismaService (Prisma 7 + MySQL via Driver Adapter)
 *
 * Prisma 7 requiere que el PrismaClient se construya con:
 * - adapter (para conexión directa con driver JS)
 * o accelerateUrl
 *
 * Para MySQL se usa @prisma/adapter-mariadb (compatible con MySQL).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('❌ DATABASE_URL no está definido en el archivo .env');
    }

    // ✅ Convertimos mysql://... a partes compatibles con el adapter
    // Esto evita problemas de parsing del adapter cuando se le pasa el string directo.
    const adapterConfig = PrismaService.parseMysqlUrl(databaseUrl);

    // ✅ Adapter Prisma (MySQL/MariaDB) usando driver "mariadb"
    const adapter = new PrismaMariaDb({
      host: adapterConfig.host,
      port: adapterConfig.port,
      user: adapterConfig.user,
      password: adapterConfig.password,
      database: adapterConfig.database,
      connectionLimit: adapterConfig.connectionLimit,
    });

    super({
      adapter,
      log: ['warn', 'error'], // ✅ puedes agregar 'query' si quieres debug
    });
  }

  /**
   * ✅ Nest hook: conecta Prisma al iniciar el módulo
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * ✅ Nest hook: desconecta Prisma al cerrar la app
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * ✅ Parser robusto de DATABASE_URL mysql://user:pass@host:3306/db
   * Retorna un objeto listo para el adapter.
   */
  private static parseMysqlUrl(databaseUrl: string): {
    host: string;
    port: number;
    user: string;
    password?: string;
    database: string;
    connectionLimit: number;
  } {
    let url: URL;

    try {
      url = new URL(databaseUrl);
    } catch (error) {
      throw new Error(
        `❌ DATABASE_URL inválida. Debe tener formato mysql://USER:PASSWORD@HOST:PORT/DB\nValor actual: ${databaseUrl}`,
      );
    }

    if (url.protocol !== 'mysql:') {
      throw new Error(
        `❌ DATABASE_URL debe comenzar con mysql://\nValor actual: ${databaseUrl}`,
      );
    }

    const host = url.hostname;
    const port = url.port ? Number(url.port) : 3306;
    const user = decodeURIComponent(url.username || '');
    const password = url.password ? decodeURIComponent(url.password) : undefined;
    const database = url.pathname?.replace('/', '');

    if (!host || !user || !database) {
      throw new Error(
        `❌ DATABASE_URL incompleta. Debe incluir host, user y database.\nValor actual: ${databaseUrl}`,
      );
    }

    if (!Number.isFinite(port)) {
      throw new Error(`❌ Puerto inválido en DATABASE_URL: ${url.port}`);
    }

    return {
      host,
      port,
      user,
      password,
      database,
      connectionLimit: 10, // ✅ límite seguro para dev/local
    };
  }
}
