import { AdminLogLevel } from './admin-logs-query.dto';

export type AdminLogLevelNormalized = AdminLogLevel | 'UNKNOWN';

export interface AdminLogEntryDto {
  index: number;              // correlativo dentro del resultado filtrado
  timestamp: string;          // ISO o string raw si no parsea
  level: AdminLogLevelNormalized;
  message: string;
  raw: string;                // línea original (útil para soporte)
}

export interface AdminLogsResponseDto {
  page: number;
  size: number;
  total: number;

  level?: string;
  from?: string;
  to?: string;
  q?: string;

  /** último evento detectado (si existe) */
  lastEventAt?: string;

  /** ruta física del archivo (debug). Si no lo quieres, bórralo del service. */
  source?: string;

  items: AdminLogEntryDto[];
}
