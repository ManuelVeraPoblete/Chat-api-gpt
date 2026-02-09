// src/modules/workday/workday.types.ts

/**
 * ✅ Estados de jornada (simple y explícito)
 * - NOT_STARTED: aún no marca entrada
 * - ACTIVE: trabajando (jornada activa)
 * - PAUSED: pausa iniciada (se cierra al cambiar de estado)
 * - LUNCH: colación iniciada (se cierra al cambiar de estado)
 * - ENDED: desconectado / finalizado (según regla de negocio)
 */
export enum WorkdayStatus {
  NOT_STARTED = 'NOT_STARTED',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  LUNCH = 'LUNCH',
  ENDED = 'ENDED',
}

/**
 * ✅ Tipos de evento de auditoría (event-sourcing light)
 * Nos permite ver "qué pasó" sin depender solo de campos.
 */
export enum WorkdayEventType {
  START = 'START',
  PAUSE = 'PAUSE',
  LUNCH = 'LUNCH',
  RESUME = 'RESUME',
  END = 'END',
}

export type WorkdayEvent = {
  type: WorkdayEventType;
  at: Date;
};
