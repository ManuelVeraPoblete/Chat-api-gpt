import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';

/**
 * ✅ MulterExceptionFilter
 *
 * Convierte errores comunes de Multer a respuestas HTTP claras.
 *
 * Beneficios:
 * - Mejora UX en Front (mensajes legibles)
 * - Evita respuestas 500 sin contexto
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    // ✅ Mensajes típicos
    const message = this.mapMessage(exception);

    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
      error: 'UPLOAD_ERROR',
    });
  }

  private mapMessage(err: MulterError): string {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return 'El archivo excede el tamaño máximo permitido.';
      case 'LIMIT_FILE_COUNT':
        return 'Se excedió el número máximo de archivos por mensaje.';
      case 'LIMIT_UNEXPECTED_FILE':
        return 'Archivo inesperado o nombre de campo incorrecto (usa "files").';
      default:
        return `Error subiendo archivo: ${err.message}`;
    }
  }
}
