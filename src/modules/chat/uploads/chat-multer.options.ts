import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { BadRequestException } from '@nestjs/common';

import {
  CHAT_MAX_FILE_SIZE_BYTES,
  isAllowedMimeType,
} from './chat-upload.constants';

/**
 * ✅ Configuración de Multer para uploads del Chat
 *
 * Buenas prácticas:
 * - Disk storage para desarrollo (simple y estable)
 * - Nombre único (evita colisiones)
 * - Validación por MIME type
 * - Límite de tamaño por archivo
 */
export function chatMulterOptions(): MulterOptions {
  const uploadsDir = join(process.cwd(), 'uploads', 'chat');

  // ✅ Aseguramos el directorio destino
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const safeExt = getSafeExtension(file.originalname, file.mimetype);
        const uniqueName = `${Date.now()}_${randomUUID()}${safeExt}`;
        cb(null, uniqueName);
      },
    }),

    limits: {
      fileSize: CHAT_MAX_FILE_SIZE_BYTES,
    },

    fileFilter: (_req, file, cb) => {
      // ✅ Validación fuerte por MIME (NO por extensión)
      if (!isAllowedMimeType(file.mimetype)) {
        return cb(
          new BadRequestException(
            `Tipo de archivo no permitido (${file.mimetype}). ` +
              `Solo se permiten imágenes y documentos comunes (pdf/docx/xlsx/etc).`,
          ) as any,
          false,
        );
      }

      return cb(null, true);
    },
  };
}

/**
 * ✅ Extensión segura
 * - Prioridad: extensión original
 * - Fallback: inferir por mimetype (si el nombre viene sin extensión)
 */
function getSafeExtension(originalName: string, mimeType: string): string {
  const fromName = extname(originalName);
  if (fromName) return fromName.toLowerCase();

  const guessed = guessExtensionFromMime(mimeType);
  return guessed ?? '';
}

/**
 * ✅ Inferencia simple de extensión
 * (evitamos dependencias extra)
 */
function guessExtensionFromMime(mimeType: string): string | null {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',

    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'text/csv': '.csv',

    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',

    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',

    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',

    'application/zip': '.zip',
    'application/x-zip-compressed': '.zip',
  };

  return map[mimeType] ?? null;
}
