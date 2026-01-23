import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * ✅ DTO: Validación del body al enviar un mensaje
 * Ejemplo:
 * {
 *   "text": "Hola asistente"
 * }
 */
export class SendMessageDto {
  /**
   * ✅ Texto opcional
   * - Puede venir vacío si el mensaje es solo adjuntos.
   * - El service valida que exista texto o archivos.
   */
  @IsOptional()
  @IsString({ message: 'El campo text debe ser un string' })
  @MaxLength(4000, { message: 'El mensaje no puede exceder 4000 caracteres' })
  text?: string;
}
