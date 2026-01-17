import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * ✅ DTO: Validación del body al enviar un mensaje
 * Ejemplo:
 * {
 *   "text": "Hola asistente"
 * }
 */
export class SendMessageDto {
  @IsString({ message: 'El campo text debe ser un string' })
  @MinLength(1, { message: 'El mensaje no puede estar vacío' })
  @MaxLength(4000, { message: 'El mensaje no puede exceder 4000 caracteres' })
  text!: string;
}
