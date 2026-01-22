import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * ✅ Conversation
 * Representa un “chat” entre 2 usuarios.
 *
 * participants:
 * - Guarda los 2 userId (UUID) ordenados (por ejemplo con .sort() en el service)
 * - Así podemos buscar una conversación sin importar el orden.
 *
 * lastMessageAt:
 * - Nos sirve para ordenar chats por actividad (tipo WhatsApp)
 */
@Schema({ timestamps: true })
export class Conversation extends Document {
  /**
   * ✅ Lista de participantes (ej: ["idA", "idB"])
   *
   * ✅ Importante:
   * - No declaramos `index: true` aquí porque el índice se define más abajo con `ConversationSchema.index(...)`.
   * - Si se define en ambos lados (decorator + schema.index), Mongoose mostrará el warning:
   *   "Duplicate schema index on { participants: 1 }".
   */
  @Prop({ type: [String], required: true })
  participants!: string[];

  /**
   * ✅ Fecha del último mensaje (útil para ordenar)
   */
  @Prop({ type: Date, default: Date.now })
  lastMessageAt!: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

/**
 * ✅ Índice para buscar rápido por participants
 * (no importa el orden mientras guardemos participants ordenado en el service)
 */
ConversationSchema.index({ participants: 1 });
