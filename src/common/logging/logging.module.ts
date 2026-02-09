// src/common/logging/logging.module.ts
import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import type { Logger } from 'pino';

import { createAppLogger } from './logger.factory';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { TraceMiddleware } from './trace.middleware';

@Global()
@Module({
  providers: [
    {
      provide: 'APP_LOGGER',
      useFactory: (): Logger => createAppLogger(),
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (logger: Logger) => new HttpLoggingInterceptor(logger),
      inject: ['APP_LOGGER'],
    },
    TraceMiddleware,
  ],
  exports: ['APP_LOGGER'],
})
export class LoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    //  Se ejecuta primero para crear traceId en TODA request
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
