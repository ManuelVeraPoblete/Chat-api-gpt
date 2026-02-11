// src/modules/workday/workday.types.ts

/**
 * ✅ Estados de jornada (simple y explícito)
 *
 * Importante (regla de negocio):
 * - ENDED se interpreta como "desconectado" (OFFLINE) dentro del mismo día.
 *   El usuario puede volver a conectarse (reconnect) sin crear un nuevo documento.
 *
 * - NOT_STARTED: aún no marca entrada
 * - ACTIVE: trabajando (jornada activa)
 * - PAUSED: pausa iniciada
 * - LUNCH: colación iniciada
 * - ENDED: desconectado (puede reconectar)
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
 *
 * Por qué eventos:
 * - Permiten reconstruir "qué pasó" incluso si el usuario comete errores.
 * - Habilitan cierres defensivos (ej: cerrar pausa abierta al desconectar).
 */
export enum WorkdayEventType {
  START = 'START',
  PAUSE = 'PAUSE',
  LUNCH = 'LUNCH',
  RESUME = 'RESUME',

  /**
   * END = Desconexión (histórico, se mantiene por compatibilidad)
   */
  END = 'END',

  /**
   * Re-conexión después de estar ENDED (desconectado).
   */
  RECONNECT = 'RECONNECT',

  /**
   * Acción de recuperación:
   * fuerza el estado a ACTIVE cerrando intervalos abiertos de forma defensiva.
   */
  RESET = 'RESET',
}

export type WorkdayEvent = {
  type: WorkdayEventType;
  at: Date;
};
