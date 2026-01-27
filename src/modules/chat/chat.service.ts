import { BadRequestException, Injectable } from '@nestjs/common';
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

    private readonly openAiService: OpenAiService,
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
   * Incluye adjuntos (attachments) para el Front (WhatsApp-like)
   */
  private toApiMessage(doc: any) {
    return {
      id: String(doc._id),
      conversationId: String(doc.conversationId),
      senderId: String(doc.senderId),
      role: doc.role,
      text: doc.text ?? '',
      attachments: doc.attachments ?? [], // ✅ NUEVO
      createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    };
  }

  /**
   * ✅ GET /chat/:peerId/messages
   * Devuelve historial del chat (incluye adjuntos)
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
      .sort({ createdAt: -1 }) // ✅ newest first (para FlatList inverted)
      .limit(limit)
      .exec();

    return {
      conversationId: String(conv._id),
      messages: msgs.map((m) => this.toApiMessage(m)),
    };
  }

  /**
   * ✅ Construye adjuntos persistibles en Mongo:
   * - IMAGE / FILE (desde multer)
   * - LOCATION (desde dto/field)
   */
  private buildAttachments(files: Express.Multer.File[] = [], location?: LocationInput) {
    const attachments: any[] = [];

    // ✅ Archivos físicos subidos (multer)
    for (const f of files) {
      const mime = f.mimetype ?? 'application/octet-stream';
      const isImage = mime.startsWith('image/');

      attachments.push({
        id: randomUUID(),
        kind: isImage ? 'IMAGE' : 'FILE',
        url: this.buildPublicFileUrl(f.filename), // ✅ se sirve por /uploads/chat/...
        fileName: f.originalname,
        mimeType: mime,
        fileSize: f.size ?? 0,
      });
    }

    // ✅ Ubicación WhatsApp-like
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
   * Importante: en main.ts vamos a servir /uploads como estático
   */
  private buildPublicFileUrl(filename: string): string {
    return `/uploads/chat/${filename}`;
  }

  /**
   * ✅ Validación de payload (Clean Code)
   * Reglas:
   * - No permitimos mensaje completamente vacío (sin texto, sin archivos, sin ubicación)
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
   *
   * Soporta 2 formas (compatibilidad + PRO):
   * 1) sendMessage(userId, peerId, "hola")                ✅ legacy
   * 2) sendMessage(userId, peerId, { text, files, location }) ✅ WhatsApp PRO
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

    // ✅ Adjuntos listos para persistencia
    const attachments = this.buildAttachments(payload.files ?? [], payload.location);

    // ✅ Texto puede ser "" si el mensaje es solo adjuntos (WhatsApp-like)
    const safeText = (payload.text ?? '').trim();

    // ✅ 1) Guardar mensaje del usuario
    const userMsg = await this.messageModel.create({
      conversationId: String(conv._id),
      senderId: userId,
      role: 'user',
      text: safeText,
      attachments, // ✅ NUEVO
    });

    // ✅ 2) Actualizar lastMessageAt
    await this.conversationModel.updateOne(
      { _id: conv._id },
      { $set: { lastMessageAt: new Date() } },
    );

    const created: any[] = [this.toApiMessage(userMsg)];

    /**
     * ✅ 3) Si el destinatario es el asistente => ChatGPT responde
     *
     * Reglas:
     * - Responde si:
     *   - hay texto
     *   - o hay ubicación/archivos (para confirmar recepción)
     */
    if (this.assistantUserId && peerId === this.assistantUserId) {
      // ✅ Texto para IA: si viene vacío, describimos adjuntos
      const aiUserText = safeText || this.describeUserPayloadForAi(payload, attachments);

      const assistantText = await this.generateAssistantReply(String(conv._id), aiUserText);

      const assistantMsg = await this.messageModel.create({
        conversationId: String(conv._id),
        senderId: this.assistantUserId,
        role: 'assistant',
        text: assistantText,
        attachments: [], // ✅ asistente no adjunta por ahora
      });

      created.push(this.toApiMessage(assistantMsg));

      await this.conversationModel.updateOne(
        { _id: conv._id },
        { $set: { lastMessageAt: new Date() } },
      );
    }

    return { created };
  }

  /**
   * ✅ Describe payload cuando el usuario envía adjuntos sin texto.
   * Esto mejora la respuesta del asistente sin inventar.
   */
  private describeUserPayloadForAi(payload: SendMessageInput, attachments: any[]): string {
    const parts: string[] = [];

    if ((payload.files?.length ?? 0) > 0) {
      parts.push(`El usuario envió ${payload.files?.length} archivo(s).`);
    }

    if (payload.location) {
      parts.push(
        `El usuario compartió una ubicación: lat=${payload.location.latitude}, lng=${payload.location.longitude}.`,
      );
    }

    // ✅ Fallback mínimo
    if (!parts.length && attachments?.length) {
      parts.push('El usuario envió adjuntos.');
    }

    return parts.join(' ');
  }

  /**
   * ✅ Genera respuesta del asistente con historial reciente
   * Incluye una descripción de adjuntos para contexto.
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
      .map((m: any) => {
        const roleLabel = m.role === 'assistant' ? 'Asistente' : 'Usuario';
        const text = (m.text ?? '').trim();
        const attachmentHint = this.describeAttachmentsForHistory(m.attachments ?? []);

        const line = [text, attachmentHint].filter(Boolean).join(' ');
        return `${roleLabel}: ${line}`.trim();
      })
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

  /**
   * ✅ Describe adjuntos para historial IA (sin meter ruido)
   */
  private describeAttachmentsForHistory(attachments: any[]): string {
    if (!attachments?.length) return '';

    const hasLocation = attachments.some((a) => a.kind === 'LOCATION');
    const fileCount = attachments.filter((a) => a.kind === 'FILE').length;
    const imageCount = attachments.filter((a) => a.kind === 'IMAGE').length;

    const parts: string[] = [];
    if (hasLocation) parts.push('[Ubicación compartida]');
    if (imageCount) parts.push(`[${imageCount} imagen(es)]`);
    if (fileCount) parts.push(`[${fileCount} archivo(s)]`);

    return parts.join(' ');
  }
}
