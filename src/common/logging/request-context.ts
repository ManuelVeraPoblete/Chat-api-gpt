// src/common/logging/request-context.ts
import { AsyncLocalStorage } from 'async_hooks';

/**
 *  Contexto por request usando AsyncLocalStorage
 * - Permite correlacionar logs HTTP ↔ SQL ↔ operaciones Prisma
 */
export type RequestContextStore = {
  traceId: string;
  userId?: string | null;
};

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getTraceId(): string | null {
  return requestContext.getStore()?.traceId ?? null;
}

export function getUserId(): string | null {
  return requestContext.getStore()?.userId ?? null;
}
