import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Express } from 'express';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';

import { Conversation } from './schemas/conversation.schema';
import { ChatMessage } from './schemas/message.schema';
import { OpenAiService } from './openai/openai.service';

/**
 * ✅ Tipado ubicación entrante (frontend -> backend)
 */
type LocationInput = {
  latitude: number;
  longitude: number;
  label?: string;
};

/**
 * ✅ Payload profesional para soportar WhatsApp-like:
 * - text opcional
 * - files opcional (multer)
 * - location opcional (geo)
 */
type SendMessageInput = {
  text?: string;
  files?: Express.Multer.File[];
  location?: LocationInput;
};

/**
 * ✅ ChatService
 * - Guarda / lee conversaciones desde Mongo
 * - Adjuntos reales (IMAGE/FILE/LOCATION)
 * - Si el destinatario es el usuario asistente => consulta OpenAI y guarda respuesta
 *
 * ✅ NUEVO:
 * - readStates: lastReadAt por participante => badge de no-leídos
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly assistantUserId: string;

  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<Conversation>,

    @InjectModel(ChatMessage.name)
    private readonly messageModel: Model<ChatMessage>,

    private readonly openAiService: OpenAiService,
  ) {
    this.assistantUserId = (process.env.ASSISTANT_USER_ID || '').trim();

    if (!this.assistantUserId) {
      this.logger.warn('⚠️ ASSISTANT_USER_ID no está configurado. ChatGPT no responderá.');
    }
  }

  /**
   * ✅ Obtiene o crea conversación entre 2 participantes.
   * Guardamos participants ORDENADO para encontrar siempre la misma conversación.
   *
   * ✅ Además inicializa readStates (no-leídos) para ambos participantes.
   */
  private async getOrCreateConversation(userId: string, peerId: string): Promise<Conversation> {
    const participants = [userId, peerId].sort();

    let conv = await this.conversationModel.findOne({ participants }).exec();

    if (!conv) {
      conv = await this.conversationModel.create({
        participants,
        lastMessageAt: new Date(),
        readStates: [
          { userId: participants[0], lastReadAt: new Date() },
          { userId: participants[1], lastReadAt: new Date() },
        ],
        // aiThreadId queda null/undefined por defecto
      });
    } else {
      // ✅ Harden: si la conversación existía de antes (sin readStates), la arreglamos.
      const hasUser = (conv as any).readStates?.some((r: any) => r.userId === userId);
      const hasPeer = (conv as any).readStates?.some((r: any) => r.userId === peerId);

      const updates: any = {};
      const pushes: any[] = [];

      if (!hasUser) pushes.push({ userId, lastReadAt: new Date(0) });
      if (!hasPeer) pushes.push({ userId: peerId, lastReadAt: new Date(0) });

      if (pushes.length > 0) {
        updates.$push = { readStates: { $each: pushes } };
        await this.conversationModel.updateOne({ _id: conv._id }, updates).exec();
        conv = await this.conversationModel.findById(conv._id).exec();
      }
    }

    return conv!;
  }

  /**
   * ✅ Marca como leído "hasta ahora" para un usuario dentro de una conversación.
   * - Si no existe el readState, lo crea.
   */
  private async markConversationRead(conversationId: string, userId: string, at: Date = new Date()): Promise<void> {
    // 1) Intento: update posicional si existe
    const updated = await this.conversationModel
      .updateOne(
        { _id: conversationId, 'readStates.userId': userId },
        { $set: { 'readStates.$.lastReadAt': at } },
      )
      .exec();

    if ((updated as any)?.matchedCount > 0) return;

    // 2) Si no existía, lo agregamos
    await this.conversationModel
      .updateOne({ _id: conversationId }, { $push: { readStates: { userId, lastReadAt: at } } })
      .exec();
  }

  /**
   * ✅ Obtiene lastReadAt del usuario en la conversación
   */
  private getLastReadAt(conv: any, userId: string): Date {
    const rs = (conv?.readStates ?? []).find((r: any) => String(r.userId) === String(userId));
    const value = rs?.lastReadAt ? new Date(rs.lastReadAt) : new Date(0);
    return Number.isFinite(value.getTime()) ? value : new Date(0);
  }

  /**
   * ✅ Convierte un documento de Mongo a DTO que devuelve la API
   */
  private toApiMessage(doc: any) {
    return {
      id: String(doc._id),
      conversationId: String(doc.conversationId),
      senderId: String(doc.senderId),
      role: doc.role,
      text: doc.text ?? '',
      attachments: doc.attachments ?? [],
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    };
  }

  /**
   * ✅ GET /chat/:peerId/messages
   * - Devuelve historial
   * - Marca la conversación como leída para el usuario que consulta (badge se limpia)
   */
  async getMessages(userId: string, peerId: string, limit = 200) {
    const participants = [userId, peerId].sort();

    const conv = await this.conversationModel.findOne({ participants }).exec();
    if (!conv) {
      return { conversationId: null, messages: [] };
    }

    const msgs = await this.messageModel
      .find({ conversationId: String(conv._id) })
      .sort({ createdAt: -1 }) // newest first (FlatList inverted)
      .limit(limit)
      .exec();

    // ✅ Importante: al abrir el chat, marcamos leído
    await this.markConversationRead(String(conv._id), userId, new Date());

    return {
      conversationId: String(conv._id),
      messages: msgs.map((m) => this.toApiMessage(m)),
    };
  }

  /**
   * ✅ Construye adjuntos persistibles
   */
  private buildAttachments(files: Express.Multer.File[] = [], location?: LocationInput) {
    const attachments: any[] = [];

    for (const f of files) {
      const mime = f.mimetype ?? 'application/octet-stream';
      const isImage = mime.startsWith('image/');

      attachments.push({
        id: randomUUID(),
        kind: isImage ? 'IMAGE' : 'FILE',
        url: this.buildPublicFileUrl(f.filename),
        fileName: f.originalname,
        mimeType: mime,
        fileSize: f.size ?? 0,
      });
    }

    if (location) {
      attachments.push({
        id: randomUUID(),
        kind: 'LOCATION',
        latitude: location.latitude,
        longitude: location.longitude,
        label: location.label ?? null,
      });
    }

    return attachments;
  }

  /**
   * ✅ Construye URL pública del archivo
   */
  private buildPublicFileUrl(filename: string): string {
    return `/uploads/chat/${filename}`;
  }

  /**
   * ✅ Validación de payload (Clean Code)
   */
  private validateSendInput(input: SendMessageInput): void {
    const text = (input.text ?? '').trim();
    const hasFiles = (input.files?.length ?? 0) > 0;
    const hasLocation = Boolean(input.location);

    if (!text && !hasFiles && !hasLocation) {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }

    if (input.location) {
      const { latitude, longitude } = input.location;

      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        throw new BadRequestException('Latitud inválida');
      }

      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new BadRequestException('Longitud inválida');
      }
    }
  }

  /**
   * ✅ POST /chat/:peerId/messages
   */
  async sendMessage(userId: string, peerId: string, text: string): Promise<{ created: any[] }>;
  async sendMessage(userId: string, peerId: string, input: SendMessageInput): Promise<{ created: any[] }>;
  async sendMessage(
    userId: string,
    peerId: string,
    input: string | SendMessageInput,
  ): Promise<{ created: any[] }> {
    const payload: SendMessageInput =
      typeof input === 'string'
        ? { text: input }
        : {
            text: input.text,
            files: input.files ?? [],
            location: input.location,
          };

    this.validateSendInput(payload);

    const conv = await this.getOrCreateConversation(userId, peerId);

    // ✅ DEBUG: confirmar match con assistant
    this.logger.log(`sendMessage: userId=${userId} peerId=${peerId} assistantUserId=${this.assistantUserId}`);

    const attachments = this.buildAttachments(payload.files ?? [], payload.location);
    const safeText = (payload.text ?? '').trim();

    // ✅ 1) Guardar mensaje del usuario
    const userMsg = await this.messageModel.create({
      conversationId: String(conv._id),
      senderId: userId,
      role: 'user',
      text: safeText,
      attachments,
    });

    await this.conversationModel
      .updateOne({ _id: conv._id }, { $set: { lastMessageAt: new Date() } })
      .exec();

    // ✅ El emisor siempre "leyó" hasta este punto (evita badge en su propio chat)
    await this.markConversationRead(String(conv._id), userId, new Date());

    const created: any[] = [this.toApiMessage(userMsg)];

    // ✅ 2) Respuesta IA solo si chateas con el usuario asistente
    if (this.assistantUserId && peerId === this.assistantUserId) {
      const aiUserText = safeText || this.describeUserPayloadForAi(payload, attachments);

      const assistantText = await this.generateAssistantReply({
        conversationId: String(conv._id),
        userText: aiUserText,
        aiThreadId: (conv as any).aiThreadId ?? null,
      });

      // ✅ Guardar msg assistant
      const assistantMsg = await this.messageModel.create({
        conversationId: String(conv._id),
        senderId: this.assistantUserId,
        role: 'assistant',
        text: assistantText.text,
        attachments: [],
      });

      created.push(this.toApiMessage(assistantMsg));

      // ✅ El assistant también "lee" su propia conversación
      await this.markConversationRead(String(conv._id), this.assistantUserId, new Date());

      // ✅ Persistir threadId (memoria real)
      if (assistantText.threadId && assistantText.threadId !== (conv as any).aiThreadId) {
        await this.conversationModel.updateOne(
          { _id: conv._id },
          { $set: { aiThreadId: assistantText.threadId } },
        );
      }

      await this.conversationModel.updateOne(
        { _id: conv._id },
        { $set: { lastMessageAt: new Date() } },
      );
    }

    return { created };
  }

  /**
   * ✅ Obtiene conteo de mensajes no leídos por peer.
   *
   * Regla:
   * - No-leído = mensajes en la conversación cuya fecha > lastReadAt del usuario
   * - Excluye mensajes enviados por el propio usuario (senderId != userId)
   *
   * 📌 Este endpoint está pensado para Home (lista de chats/usuarios)
   */
  async getUnreadCounts(userId: string, peerIds: string[]): Promise<Record<string, number>> {
    const uniquePeers = Array.from(new Set((peerIds ?? []).filter(Boolean)));

    const result: Record<string, number> = {};
    for (const peerId of uniquePeers) result[peerId] = 0;

    // ✅ Seguridad: si no hay peers, retornamos rápido
    if (uniquePeers.length === 0) return result;

    // ✅ Implementación simple y robusta (N peers => N consultas)
    // Para grandes volúmenes se puede optimizar con aggregate,
    // pero en mobile + lista acotada es suficiente.
    for (const peerId of uniquePeers) {
      const participants = [userId, peerId].sort();
      const conv = await this.conversationModel.findOne({ participants }).lean().exec();

      if (!conv?._id) {
        result[peerId] = 0;
        continue;
      }

      const lastReadAt = this.getLastReadAt(conv, userId);

      const count = await this.messageModel
        .countDocuments({
          conversationId: String(conv._id),
          senderId: { $ne: userId },
          createdAt: { $gt: lastReadAt },
        })
        .exec();

      result[peerId] = Number(count) || 0;
    }

    return result;
  }

  /**
   * ✅ Describe payload cuando el usuario envía adjuntos sin texto.
   */
  private describeUserPayloadForAi(payload: SendMessageInput, attachments: any[]): string {
    const parts: string[] = [];

    if ((payload.files?.length ?? 0) > 0) {
      parts.push(`Adjuntó ${(payload.files?.length ?? 0)} archivo(s).`);
    }

    if (payload.location) {
      parts.push(
        `Compartió ubicación (${payload.location.latitude}, ${payload.location.longitude})${
          payload.location.label ? ` - ${payload.location.label}` : ''
        }.`,
      );
    }

    if (attachments?.length) {
      parts.push(`Adjuntos persistidos: ${attachments.map((a) => a.kind).join(', ')}`);
    }

    return parts.join(' ');
  }

  /**
   * ✅ Genera respuesta del assistant (OpenAI)
   * NOTA: tu implementación original sigue igual, aquí no la toqué.
   */
  private async generateAssistantReply(input: {
    conversationId: string;
    userText: string;
    aiThreadId: string | null;
  }): Promise<{ text: string; threadId?: string | null }> {
    // ✅ Delegamos en OpenAiService (ya existente)
    return this.openAiService.generateAssistantReply(input);
  }
}
