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
 * Mejora PRO:
 * - Persiste aiThreadId por conversación (memoria real del Assistant)
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
   */
  private async getOrCreateConversation(userId: string, peerId: string): Promise<Conversation> {
    const participants = [userId, peerId].sort();

    let conv = await this.conversationModel.findOne({ participants }).exec();

    if (!conv) {
      conv = await this.conversationModel.create({
        participants,
        lastMessageAt: new Date(),
        // aiThreadId queda null/undefined por defecto
      });
    }

    return conv;
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

    await this.conversationModel.updateOne(
      { _id: conv._id },
      { $set: { lastMessageAt: new Date() } },
    );

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
   * ✅ Describe payload cuando el usuario envía adjuntos sin texto.
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

    if (!parts.length && attachments?.length) {
      parts.push('El usuario envió adjuntos.');
    }

    return parts.join(' ');
  }

  /**
   * ✅ Genera respuesta del asistente con historial reciente.
   * Devuelve text + threadId para persistir memoria del Assistant.
   */
  private async generateAssistantReply(params: {
    conversationId: string;
    userText: string;
    aiThreadId: string | null;
  }): Promise<{ text: string; threadId: string | null }> {
    const { conversationId, userText, aiThreadId } = params;

    const history = await this.messageModel
      .find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();

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

    // ✅ ID del Assistant Entelgy (UI)
    const entelgyAssistantId = process.env.OPENAI_ENTELGY_ASSISTANT_ID?.trim();

    // ✅ System para RAG manual (solo aplica si NO hay assistantId)
    const system = `
Eres un asistente corporativo interno de la empresa.
Tu única fuente de verdad son los documentos internos proporcionados mediante file_search.

REGLAS ABSOLUTAS:
1. Está TERMINANTEMENTE PROHIBIDO usar conocimiento general fuera de los documentos.
2. Solo puedes responder si la información aparece explícitamente en documentos internos.
3. Si no encuentras info suficiente, responde EXACTAMENTE:
"No tengo información en la base corporativa para responder esa consulta. Por favor contacta a RRHH o a la Mesa de Ayuda TI."
4. No inventes políticas, procedimientos, fechas, personas, correos ni configuraciones.
5. Si la pregunta es ambigua, pide una sola aclaración corta.

Idioma: Español
Formato: Claro, profesional, con pasos numerados cuando aplique.
`.trim();

    try {
      // ✅ 1) Modo Assistant (Entelgy real con File Search del assistant)
      if (entelgyAssistantId) {
        // OJO: para persistir memoria, el OpenAiService debe soportar threadId reutilizable.
        const resp = await this.openAiService.replyWithAssistant({
          assistantId: entelgyAssistantId,
          historyText,
          userText,
          threadId: aiThreadId, // ✅ reutiliza
        } as any);

        // Si tu OpenAiService aún no soporta threadId, devuelvo null por compatibilidad
        if (typeof resp === 'string') {
          return { text: resp, threadId: null };
        }

        return { text: resp.text, threadId: resp.threadId };
      }

      // ✅ 2) RAG manual (vector_store_id)
      const manual = await this.openAiService.replyWithCompanyKnowledge({
        system,
        historyText,
        userText,
      });

      return { text: manual, threadId: null };
    } catch (err) {
      this.logger.error('❌ Error llamando a OpenAI', err as any);
      return { text: 'Lo siento, tuve un problema generando la respuesta. Intenta nuevamente.', threadId: null };
    }
  }

  /**
   * ✅ Describe adjuntos para historial IA
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
