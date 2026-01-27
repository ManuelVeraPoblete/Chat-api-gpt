// src/modules/chat/schemas/message.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * ✅ Tipos de rol del mensaje:
 * - user: mensaje enviado por un usuario real
 * - assistant: mensaje generado por ChatGPT (Asistente Corporativo)
 */
export type MessageRole = 'user' | 'assistant';

/**
 * ✅ Tipos de attachment:
 * - IMAGE => imagen subida
 * - FILE => documento/archivo subido
 * - LOCATION => ubicación compartida (WhatsApp-like)
 */
export type ChatAttachmentKind = 'IMAGE' | 'FILE' | 'LOCATION';

/**
 * ✅ Subdocumento: ChatAttachment
 * Se guarda dentro del mensaje (Mongo).
 *
 * Clean Code:
 * - Unión "discriminada" por `kind`
 * - Campos opcionales según el tipo
 */
@Schema({ _id: false })
export class ChatAttachment {
  /**
   * ✅ Id propio del attachment (no dependemos del _id de Mongo)
   * Esto ayuda mucho al front para listas y render.
   */
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true, enum: ['IMAGE', 'FILE', 'LOCATION'] })
  kind!: ChatAttachmentKind;

  // ✅ Para IMAGE / FILE
  @Prop({ type: String })
  url?: string;

  @Prop({ type: String })
  fileName?: string;

  @Prop({ type: String })
  mimeType?: string;

  @Prop({ type: Number })
  fileSize?: number;

  /**
   * ✅ Metadata opcional de imagen
   * IMPORTANTE: Mongoose no infiere bien unions => declarar type + default
   */
  @Prop({ type: Number, default: null })
  width?: number | null;

  @Prop({ type: Number, default: null })
  height?: number | null;

  // ✅ Para LOCATION
  @Prop({ type: Number })
  latitude?: number;

  @Prop({ type: Number })
  longitude?: number;

  @Prop({ type: String, default: null })
  label?: string | null;
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
   * - Puede ser "" cuando el mensaje es solo adjuntos (WhatsApp-like)
   */
  @Prop({ required: false, default: '' })
  text!: string;

  /**
   * ✅ Adjuntos del mensaje (archivos o ubicación)
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
