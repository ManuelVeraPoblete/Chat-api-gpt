// src/modules/workday/utils/chile-datetime.util.ts

/**
 *  Utilidad de fechas en zona horaria Chile
 *
 * Importante:
 * - Para "jornada del día" necesitamos un dateKey estable (YYYY-MM-DD)
 * - Usamos Intl.DateTimeFormat con timeZone = America/Santiago (Node soporta esto)
 *
 * Si el servidor está en otra TZ (ej: UTC), esto evita que "cambie el día" antes/después.
 */
const CHILE_TZ = 'America/Santiago';

export function nowChile(): Date {
  // Date() siempre es UTC internamente; lo importante es cómo calculamos el dateKey.
  return new Date();
}

export function chileDateKey(date: Date = nowChile()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;

  // en-CA => YYYY-MM-DD, pero armamos manualmente para asegurar formato
  return `${y}-${m}-${d}`;
}
