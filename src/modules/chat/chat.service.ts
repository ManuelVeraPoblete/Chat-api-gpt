import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Conversation } from './schemas/conversation.schema';
import { ChatMessage } from './schemas/message.schema';
import { OpenAiService } from './openai/openai.service';

/**
 * ✅ ChatService
 * - Guarda / lee conversaciones desde Mongo
 * - Si el destinatario es "Asistente Corporativo" => consulta OpenAI y guarda la respuesta
 */
@Injectable()
export class ChatService {
  private readonly assistantUserId: string;

  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<Conversation>,

    @InjectModel(ChatMessage.name)
    private readonly messageModel: Model<ChatMessage>,

    private readonly openAiService: OpenAiService
  ) {
    this.assistantUserId = process.env.ASSISTANT_USER_ID || '';

    if (!this.assistantUserId) {
      console.warn('⚠️ ASSISTANT_USER_ID no está configurado. ChatGPT no responderá.');
    }
  }

  /**
   * ✅ Obtiene o crea conversación entre 2 participantes
   * Guardamos participants ORDENADO para encontrar siempre la misma conversación.
   */
  private async getOrCreateConversation(userId: string, peerId: string): Promise<Conversation> {
    const participants = [userId, peerId].sort();

    let conv = await this.conversationModel.findOne({ participants }).exec();

    if (!conv) {
      conv = await this.conversationModel.create({
        participants,
        lastMessageAt: new Date(),
      });
    }

    return conv;
  }

  /**
   * ✅ Convierte un documento de Mongo a DTO que devuelve la API
   * Tipado seguro para createdAt (Mongoose lo agrega por timestamps)
   */
  private toApiMessage(doc: any) {
    return {
      id: String(doc._id),
      conversationId: String(doc.conversationId),
      senderId: String(doc.senderId),
      role: doc.role,
      text: doc.text,
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    };
  }

  /**
   * ✅ Traer historial desde Mongo
   * Retorna newest-first (ideal para FlatList inverted)
   */
  async getMessages(userId: string, peerId: string, limit = 200) {
    const participants = [userId, peerId].sort();

    const conv = await this.conversationModel.findOne({ participants }).exec();
    if (!conv) {
      return {
        conversationId: null,
        messages: [],
      };
    }

    const msgs = await this.messageModel
      .find({ conversationId: String(conv._id) })
      .sort({ createdAt: -1 }) // ✅ newest first
      .limit(limit)
      .exec();

    return {
      conversationId: String(conv._id),
      messages: msgs.map((m) => this.toApiMessage(m)),
    };
  }

  /**
   * ✅ Enviar mensaje
   * 1) Guarda mensaje del usuario
   * 2) Si peer == Asistente Corporativo => genera respuesta OpenAI y guarda
   * 3) Retorna mensajes creados (usuario + opcional IA)
   */
  async sendMessage(userId: string, peerId: string, text: string) {
    const conv = await this.getOrCreateConversation(userId, peerId);

    // ✅ 1) Guardar mensaje del usuario
    const userMsg = await this.messageModel.create({
      conversationId: String(conv._id),
      senderId: userId,
      role: 'user',
      text,
    });

    // ✅ 2) Actualizar lastMessageAt (CORRECTO EN MONGO)
    await this.conversationModel.updateOne(
      { _id: conv._id },
      { $set: { lastMessageAt: new Date() } }
    );

    const created: any[] = [this.toApiMessage(userMsg)];

    // ✅ 3) Si el destinatario es el asistente => ChatGPT responde
    if (this.assistantUserId && peerId === this.assistantUserId) {
      const assistantText = await this.generateAssistantReply(String(conv._id), text);

      const assistantMsg = await this.messageModel.create({
        conversationId: String(conv._id),
        senderId: this.assistantUserId,
        role: 'assistant',
        text: assistantText,
      });

      created.push(this.toApiMessage(assistantMsg));

      await this.conversationModel.updateOne(
        { _id: conv._id },
        { $set: { lastMessageAt: new Date() } }
      );
    }

    // ✅ newest-first
    created.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return { created };
  }

  /**
   * ✅ Genera respuesta del asistente con historial reciente
   */
  private async generateAssistantReply(conversationId: string, userText: string): Promise<string> {
    // ✅ Historial corto para contexto (últimos 20)
    const history = await this.messageModel
      .find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();

    // ✅ orden correcto (oldest -> newest)
    const historyText = history
      .reverse()
      .map((m: any) => (m.role === 'assistant' ? `Asistente: ${m.text}` : `Usuario: ${m.text}`))
      .join('\n');

    const system = `
Eres el "Asistente Corporativo" de CorpChat.
Responde en español, claro y profesional.
Si falta información, pregunta de forma breve.
No inventes datos internos.
    `.trim();

    try {
      return await this.openAiService.reply({
        system,
        historyText,
        userText,
      });
    } catch (err) {
      console.error('❌ Error llamando a OpenAI:', err);
      return 'Lo siento, tuve un problema generando la respuesta. Intenta nuevamente.';
    }
  }
}
