import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import type { AttachmentKind, ChatAttachment } from '../schemas/message.schema';

/**
 * ✅ ChatAttachmentsService
 *
 * Responsabilidad única (SRP):
 * - Convertir archivos subidos (Multer) a metadata persistible en Mongo
 * - Definir la URL pública que consumirá el frontend
 *
 * Nota:
 * - En el futuro, este service se puede reemplazar por S3/MinIO
 *   sin tocar ChatService (DIP).
 */
@Injectable()
export class ChatAttachmentsService {
  /**
   * ✅ Mapea archivos de Multer a attachments embebidos.
   */
  mapUploadedFiles(files: Express.Multer.File[] | undefined | null): ChatAttachment[] {
    if (!files || files.length === 0) return [];

    return files.map((f) => {
      const kind = this.detectKind(f.mimetype);

      return {
        id: randomUUID(),
        kind,
        url: this.buildPublicUrl(f.filename),
        fileName: this.sanitizeFileName(f.originalname),
        mimeType: f.mimetype,
        fileSize: f.size,
      };
    });
  }

  /**
   * ✅ URL pública (se sirve desde main.ts con app.use('/uploads', static(...)))
   */
  private buildPublicUrl(fileNameOnDisk: string): string {
    return `/uploads/chat/${fileNameOnDisk}`;
  }

  /**
   * ✅ Detecta tipo del adjunto (Imagen vs Archivo)
   */
  private detectKind(mimeType: string): AttachmentKind {
    return mimeType?.startsWith('image/') ? 'IMAGE' : 'FILE';
  }

  /**
   * ✅ Sanitiza nombre original para evitar caracteres raros
   * - No confiamos en paths provenientes del cliente
   */
  private sanitizeFileName(name: string): string {
    return String(name)
      .replace(/\\/g, '_')
      .replace(/\//g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
