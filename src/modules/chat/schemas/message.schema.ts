import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * ✅ Tipos de rol del mensaje:
 * - user: mensaje enviado por un usuario real
 * - assistant: mensaje generado por ChatGPT (Asistente Corporativo)
 */
export type MessageRole = 'user' | 'assistant';

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
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

/**
 * ✅ Índice recomendado:
 * - Permite buscar rápido los mensajes por conversación y ordenarlos por fecha
 */
ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });
