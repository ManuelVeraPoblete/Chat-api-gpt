import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 *  UpdateLocationDto
 * Payload para actualizar la ubicación del usuario autenticado.
 *
 * - isLive=false (default): guarda ubicación puntual
 * - isLive=true: comparte ubicación por un tiempo (liveMinutes)
 */
export class UpdateLocationDto {
  @IsNumber({}, { message: 'latitude debe ser numérico' })
  @Min(-90, { message: 'latitude mínimo -90' })
  @Max(90, { message: 'latitude máximo 90' })
  latitude!: number;

  @IsNumber({}, { message: 'longitude debe ser numérico' })
  @Min(-180, { message: 'longitude mínimo -180' })
  @Max(180, { message: 'longitude máximo 180' })
  longitude!: number;

  /**
   *  Precisión opcional (metros)
   */
  @IsOptional()
  @IsNumber({}, { message: 'accuracy debe ser numérico' })
  @Min(0, { message: 'accuracy no puede ser negativo' })
  accuracy?: number;

  /**
   *  Si se comparte live
   */
  @IsOptional()
  @IsBoolean({ message: 'isLive debe ser boolean' })
  isLive?: boolean;

  /**
   *  Minutos de live share (solo si isLive=true)
   * Recomendación WhatsApp: 15, 60, 480 (8h)
   */
  @IsOptional()
  @IsNumber({}, { message: 'liveMinutes debe ser numérico' })
  @Min(1, { message: 'liveMinutes mínimo 1' })
  @Max(480, { message: 'liveMinutes máximo 480 (8 horas)' })
  liveMinutes?: number;
}
