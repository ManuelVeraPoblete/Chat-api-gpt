import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type AdminLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

/**
 * Normaliza strings vacíos a undefined.
 * - Evita errores 400 cuando llega level= o from= o q=
 */
function emptyToUndefined(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }

  return value;
}

/**
 * Query DTO para /admin/logs
 * - Todos los filtros son opcionales
 * - page/size/tail tienen defaults
 */
export class AdminLogsQueryDto {
  @Transform(({ value }) => emptyToUndefined(value))
  @IsOptional()
  @IsIn(['INFO', 'WARN', 'ERROR', 'DEBUG'])
  level?: AdminLogLevel;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsOptional()
  @IsString()
  from?: string;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsOptional()
  @IsString()
  to?: string;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsOptional()
  @IsString()
  q?: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page: number = 1;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(5)
  @Max(200)
  size: number = 25;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1000)
  @Max(50000)
  tail: number = 20000;
}
