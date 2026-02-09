// src/common/logging/trace.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { requestContext } from './request-context';

/**
 *  Middleware:
 * - crea traceId por request
 * - lo deja disponible para cualquier log posterior (DB incluido)
 * - lo expone en response header (útil para debugging)
 */
@Injectable()
export class TraceMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const traceId = req.headers['x-trace-id'] || randomUUID();

    // Si tienes auth, típicamente req.user se setea DESPUÉS (por guard),
    // pero igual dejamos placeholder y lo actualizamos más adelante en interceptor.
    requestContext.run({ traceId, userId: null }, () => {
      res.setHeader('x-trace-id', traceId);
      next();
    });
  }
}
