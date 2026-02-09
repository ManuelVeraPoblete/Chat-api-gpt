import { Injectable } from '@nestjs/common';
import type { Express } from 'express';
import { randomUUID } from 'crypto';

import type { ChatAttachmentKind } from '../schemas/message.schema';
import { ChatAttachment } from '../schemas/message.schema';

/**
 *  ChatAttachmentsService
 *
 * SRP:
 * - Solo construye "attachments" persistibles para Mongo.
 * - No guarda mensajes, no llama OpenAI, no conoce conversaciones.
 *
 * Soporta:
 * - IMAGE / FILE desde multer
 * - LOCATION (opcional) como adjunto
 */
@Injectable()
export class ChatAttachmentsService {
  /**
   *  Convierte multer files a attachments (IMAGE/FILE)
   */
  buildFileAttachments(files: Express.Multer.File[] = []): ChatAttachment[] {
    return files.map((f) => {
      const mime = f.mimetype ?? 'application/octet-stream';
      const kind: ChatAttachmentKind = mime.startsWith('image/') ? 'IMAGE' : 'FILE';

      return {
        id: randomUUID(),
        kind,
        url: this.buildPublicFileUrl(f.filename),
        fileName: f.originalname,
        mimeType: mime,
        fileSize: f.size ?? 0,
        width: null,
        height: null,
      };
    });
  }

  /**
   *  Crea un attachment de ubicación (LOCATION)
   */
  buildLocationAttachment(input: { latitude: number; longitude: number; label?: string }): ChatAttachment {
    return {
      id: randomUUID(),
      kind: 'LOCATION',
      latitude: input.latitude,
      longitude: input.longitude,
      label: input.label ?? null,
    };
  }

  /**
   *  URL pública consistente con main.ts:
   * app.useStaticAssets(process.cwd() + '/uploads', { prefix: '/uploads' })
   */
  private buildPublicFileUrl(filename: string): string {
    return `/uploads/chat/${filename}`;
  }
}
