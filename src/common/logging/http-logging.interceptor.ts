// src/common/logging/http-logging.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Logger } from 'pino';
import { redactDeep } from './redact.util';
import { requestContext } from './request-context';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const http = context.switchToHttp();
    const req = http.getRequest<any>();
    const res = http.getResponse<any>();

    const method = req.method;
    const url = req.originalUrl || req.url;

    // ✅ userId si viene por auth guard/strategy
    const userId = req?.user?.sub || req?.user?.id || null;

    // ✅ actualizamos store (si middleware lo dejó con userId null)
    const store = requestContext.getStore();
    if (store && userId && store.userId !== userId) store.userId = userId;

    const traceId = store?.traceId ?? null;

    this.logger.info(
      {
        type: 'http_request',
        traceId,
        userId,
        method,
        url,
        ip: req.ip,
        params: redactDeep(req.params || {}),
        query: redactDeep(req.query || {}),
        body: redactDeep(req.body || {}),
      },
      'HTTP Request',
    );

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.info(
            {
              type: 'http_response',
              traceId,
              userId,
              method,
              url,
              statusCode: res.statusCode,
              durationMs: Date.now() - start,
            },
            'HTTP Response',
          );
        },
        error: (err) => {
          this.logger.error(
            {
              type: 'http_error',
              traceId,
              userId,
              method,
              url,
              statusCode: res.statusCode,
              durationMs: Date.now() - start,
              error: {
                name: err?.name,
                message: err?.message,
                stack: err?.stack,
              },
            },
            'HTTP Error',
          );
        },
      }),
    );
  }
}
