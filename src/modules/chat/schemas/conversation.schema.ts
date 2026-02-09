import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 *  Subdocumento: ReadState
 * - Guarda "hasta cuándo" un usuario leyó una conversación
 * - Permite calcular no-leídos de forma determinística y barata
 */
@Schema({ _id: false })
export class ReadState {
  @Prop({ required: true, index: false })
  userId!: string;

  @Prop({ type: Date, required: true, default: () => new Date(0) })
  lastReadAt!: Date;
}

export const ReadStateSchema = SchemaFactory.createForClass(ReadState);

/**
 *  Conversation Schema
 * - participants (ordenados)
 * - lastMessageAt
 * - readStates: lastReadAt por participante (para badge de no-leídos)
 * - aiThreadId: thread persistente para el assistant (memoria real)
 */
@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ type: [String], required: true, index: true })
  participants!: string[];

  @Prop({ type: Date, default: () => new Date() })
  lastMessageAt!: Date;

  /**
   *  Estado de lectura por usuario (no-leídos)
   * Importante:
   * - Es un array para mantenerlo simple con Mongoose
   * - En conversaciones directas tendrá 2 elementos
   */
  @Prop({ type: [ReadStateSchema], default: [] })
  readStates!: ReadState[];

  //  threadId para reutilizar en conversaciones con IA
  @Prop({ type: String, required: false, default: null })
  aiThreadId?: string | null;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

//  Índices recomendados (consultas frecuentes)
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageAt: -1 });
