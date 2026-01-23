import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * ✅ Tipos de rol del mensaje:
 * - user: mensaje enviado por un usuario real
 * - assistant: mensaje generado por ChatGPT (Asistente Corporativo)
 */
export type MessageRole = 'user' | 'assistant';

/**
 * ✅ Tipo de adjunto
 * - IMAGE: imagen (jpg/png/webp)
 * - FILE: documento (pdf/docx/xlsx/etc)
 */
export type AttachmentKind = 'IMAGE' | 'FILE';

/**
 * ✅ ChatAttachment
 * Sub-documento embebido dentro de ChatMessage.
 *
 * Ventajas:
 * - Lectura del historial rápida (un solo query)
 * - No requiere colección aparte
 */
@Schema({ _id: false })
export class ChatAttachment {
  /**
   * ✅ Id del adjunto (UUID)
   */
  @Prop({ required: true })
  id!: string;

  /**
   * ✅ Tipo del adjunto (IMAGE | FILE)
   */
  @Prop({ required: true, enum: ['IMAGE', 'FILE'] })
  kind!: AttachmentKind;

  /**
   * ✅ URL pública para ver/descargar
   * Ej: /uploads/chat/xxx.jpg
   */
  @Prop({ required: true })
  url!: string;

  /**
   * ✅ Nombre original del archivo
   */
  @Prop({ required: true })
  fileName!: string;

  /**
   * ✅ MIME type
   * Ej: image/jpeg, application/pdf
   */
  @Prop({ required: true })
  mimeType!: string;

  /**
   * ✅ Tamaño en bytes
   */
  @Prop({ required: true })
  fileSize!: number;

  /**
   * ✅ Metadata opcional para imágenes (si se quiere usar a futuro)
   */
  @Prop({ required: false })
  width?: number;

  @Prop({ required: false })
  height?: number;
}

export const ChatAttachmentSchema = SchemaFactory.createForClass(ChatAttachment);

/**
 * ✅ ChatMessage
 * Representa un mensaje persistido en Mongo.
 */
@Schema({ timestamps: true })
export class ChatMessage extends Document {
  /**
   * ✅ Id de la conversación (Mongo ObjectId como string)
   */
  @Prop({ required: true, index: true })
  conversationId!: string;

  /**
   * ✅ Quién envió el mensaje (UUID del usuario en tu BD)
   */
  @Prop({ required: true })
  senderId!: string;

  /**
   * ✅ Rol (user / assistant)
   */
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role!: MessageRole;

  /**
   * ✅ Contenido del mensaje
   */
  @Prop({ required: true })
  text!: string;

  /**
   * ✅ Adjuntos asociados al mensaje
   * - Puede estar vacío
   */
  @Prop({ type: [ChatAttachmentSchema], default: [] })
  attachments!: ChatAttachment[];
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

/**
 * ✅ Índice recomendado:
 * - Permite buscar rápido los mensajes por conversación y ordenarlos por fecha
 */
ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });
