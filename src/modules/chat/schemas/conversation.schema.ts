import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * ✅ Conversation Schema
 * - participants (ordenados)
 * - lastMessageAt
 * - aiThreadId: thread persistente para el assistant (memoria real)
 */
@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ type: [String], required: true, index: true })
  participants!: string[];

  @Prop({ type: Date, default: () => new Date() })
  lastMessageAt!: Date;

  // ✅ NUEVO: threadId para reutilizar en conversaciones con IA
  @Prop({ type: String, required: false, default: null })
  aiThreadId?: string | null;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
