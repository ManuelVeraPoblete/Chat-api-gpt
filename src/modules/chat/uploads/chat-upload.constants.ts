/**
 *  Constantes de uploads para el módulo de Chat
 *
 * Mantener esto centralizado ayuda a:
 * - Reutilizar valores en Controller/Service
 * - Facilitar cambios futuros (S3, límites, etc.)
 */

/**
 * Máximo de archivos por mensaje (WhatsApp-like)
 */
export const CHAT_MAX_FILES_PER_MESSAGE = 10;

/**
 * Tamaño máximo por archivo
 * (ajústalo si tu infraestructura lo permite)
 */
export const CHAT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

/**
 *  MIME types permitidos
 * - Permitimos imágenes y documentos comunes.
 * - Evitamos ejecutables por seguridad.
 */
export const CHAT_ALLOWED_MIME_TYPES = new Set<string>([
  //  Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',

  //  Documents
  'application/pdf',
  'text/plain',
  'text/csv',

  // Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  // PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // ZIP (opcional)
  'application/zip',
  'application/x-zip-compressed',
]);

export function isAllowedMimeType(mimeType: string | undefined | null): boolean {
  if (!mimeType) return false;
  return CHAT_ALLOWED_MIME_TYPES.has(mimeType);
}
