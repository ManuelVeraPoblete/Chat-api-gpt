import 'dotenv/config';

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import type { Logger } from 'pino';

import { redactDeep, summarizeResult } from '../../common/logging/redact.util';
import { getTraceId, getUserId } from '../../common/logging/request-context';

/**
 *  PrismaService (NestJS + Prisma 7 + MySQL via Driver Adapter)
 *
 * Objetivo:
 * - Mantener tipado completo (this.prisma.user.findMany, etc.)
 * - Prisma 7: usar $extends (NO $use)
 * - Logs:
 *   - SQL real + params (via $on('query'))
 *   - args + result + duración por operación (via $extends)
 *   - correlación con traceId/userId (AsyncLocalStorage)
 */
@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'warn' | 'error'>
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    @Inject('APP_LOGGER')
    private readonly logger: Logger,
  ) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(' DATABASE_URL no está definido en el archivo .env');
    }

    //  Parse robusto de mysql://...
    const adapterConfig = PrismaService.parseMysqlUrl(databaseUrl);

    //  Adapter Prisma (MySQL/MariaDB)
    const adapter = new PrismaMariaDb({
      host: adapterConfig.host,
      port: adapterConfig.port,
      user: adapterConfig.user,
      password: adapterConfig.password,
      database: adapterConfig.database,
      connectionLimit: adapterConfig.connectionLimit,
    });

    //  PrismaClient real (con eventos)
    super({
      adapter,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });

    /**
     *  SQL real ejecutado por Prisma
     * - query + params + duration
     * - incluye traceId/userId
     */
    this.$on('query', (e: Prisma.QueryEvent) => {
      this.logger.info(
        {
          type: 'db_sql',
          traceId: getTraceId(),
          userId: getUserId(),
          durationMs: e.duration,
          query: e.query,
          params: e.params,
        },
        'DB SQL',
      );
    });

    this.$on('warn', (e: Prisma.LogEvent) => {
      this.logger.warn(
        {
          type: 'db_warn',
          traceId: getTraceId(),
          userId: getUserId(),
          message: e.message,
        },
        'DB Warn',
      );
    });

    this.$on('error', (e: Prisma.LogEvent) => {
      this.logger.error(
        {
          type: 'db_error',
          traceId: getTraceId(),
          userId: getUserId(),
          message: e.message,
        },
        'DB Error',
      );
    });

    /**
     *  Prisma 7: reemplazo de middleware ($use)
     * Usamos $extends para envolver todas las operaciones y loguear:
     * - args (variables)
     * - result (resumido + redacted)
     * - duración
     */
    const extended = this.$extends({
      query: {
        $allModels: {
          $allOperations: async ({ model, operation, args, query }) => {
            const start = Date.now();
            const safeArgs = redactDeep(args);

            try {
              const result = await query(args);

              this.logger.info(
                {
                  type: 'db_operation',
                  traceId: getTraceId(),
                  userId: getUserId(),
                  model,
                  action: operation,
                  durationMs: Date.now() - start,
                  args: safeArgs,
                  result: summarizeResult(result),
                },
                'DB Operation',
              );

              return result;
            } catch (err: any) {
              this.logger.error(
                {
                  type: 'db_operation_error',
                  traceId: getTraceId(),
                  userId: getUserId(),
                  model,
                  action: operation,
                  durationMs: Date.now() - start,
                  args: safeArgs,
                  error: {
                    name: err?.name,
                    message: err?.message,
                    stack: err?.stack,
                  },
                },
                'DB Operation Error',
              );

              throw err;
            }
          },
        },
      },
    });

    /**
     *  Clave para NO romper tu código:
     * - PrismaService sigue "extendiendo PrismaClient" => TS ve .user, .message, etc.
     * - Pero en runtime queremos que las llamadas usen el cliente extendido (logging args/result)
     *
     * Object.assign copia delegates (user, etc.) desde extended hacia this.
     */
    Object.assign(this, extended as any);
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.info({ type: 'db_connected', adapter: 'mariadb' }, 'Prisma connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.info({ type: 'db_disconnected' }, 'Prisma disconnected');
  }

  /**
   *  Parser robusto de DATABASE_URL mysql://user:pass@host:3306/db
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
    } catch {
      throw new Error(
        ` DATABASE_URL inválida. Debe tener formato mysql://USER:PASSWORD@HOST:PORT/DB\nValor actual: ${databaseUrl}`,
      );
    }

    if (url.protocol !== 'mysql:') {
      throw new Error(` DATABASE_URL debe comenzar con mysql://\nValor actual: ${databaseUrl}`);
    }

    const host = url.hostname;
    const port = url.port ? Number(url.port) : 3306;
    const user = decodeURIComponent(url.username || '');
    const password = url.password ? decodeURIComponent(url.password) : undefined;
    const database = url.pathname?.replace('/', '');

    if (!host || !user || !database) {
      throw new Error(
        ` DATABASE_URL incompleta. Debe incluir host, user y database.\nValor actual: ${databaseUrl}`,
      );
    }

    if (!Number.isFinite(port)) {
      throw new Error(` Puerto inválido en DATABASE_URL: ${url.port}`);
    }

    return {
      host,
      port,
      user,
      password,
      database,
      connectionLimit: 10,
    };
  }
}
