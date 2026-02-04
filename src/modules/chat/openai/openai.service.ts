import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

/**
 * ✅ OpenAiService
 *
 * - Mantiene TODA tu implementación actual
 * - Se agrega SOLO un método adapter:
 *   generateAssistantReply()
 *   para que ChatService no tenga errores de tipado
 *
 * ❌ No se rompe nada existente
 * ✅ Clean Architecture
 */
@Injectable()
export class OpenAiService {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly vectorStoreId?: string;
  private readonly logger = new Logger(OpenAiService.name);

  public static readonly NO_KB_MESSAGE =
    'No tengo información en la base corporativa para responder esa consulta. Por favor contacta a RRHH o a la Mesa de Ayuda TI.';

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('❌ Falta la variable OPENAI_API_KEY en el .env');
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    this.vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
    if (!this.vectorStoreId) {
      this.logger.warn('⚠️ OPENAI_VECTOR_STORE_ID no configurado (RAG manual deshabilitado)');
    }
  }

  // ===========================================================================
  // ✅ ADAPTER PARA ChatService (SOLUCIÓN AL ERROR)
  // ===========================================================================

  /**
   * ✅ Método esperado por ChatService
   * Actúa como ADAPTER hacia replyWithAssistant()
   */
  async generateAssistantReply(params: {
    conversationId: string;
    userText: string;
    aiThreadId: string | null;
  }): Promise<{ text: string; threadId?: string | null }> {
    const assistantId = process.env.OPENAI_ASSISTANT_ID;

    if (!assistantId) {
      this.logger.error('❌ OPENAI_ASSISTANT_ID no configurado');
      return {
        text: OpenAiService.NO_KB_MESSAGE,
        threadId: params.aiThreadId ?? null,
      };
    }

    const result = await this.replyWithAssistant({
      assistantId,
      historyText: '', // 🧠 historial ya lo maneja ChatService
      userText: params.userText,
      threadId: params.aiThreadId,
    });

    return {
      text: result.text,
      threadId: result.threadId,
    };
  }

  // ===========================================================================
  // ✅ RESPONSES API (SIN RAG)
  // ===========================================================================

  async reply(params: {
    system: string;
    historyText: string;
    userText: string;
  }): Promise<string> {
    const input = `${params.historyText}\n\nUsuario: ${params.userText}`.trim();

    const resp = await this.client.responses.create({
      model: this.model,
      instructions: params.system,
      input,
      temperature: 0.6,
      truncation: 'auto',
    });

    return (
      this.removeDocumentReferences(resp.output_text ?? '') ||
      OpenAiService.NO_KB_MESSAGE
    );
  }

  // ===========================================================================
  // ✅ RESPONSES API + FILE SEARCH (RAG MANUAL)
  // ===========================================================================

  async replyWithCompanyKnowledge(params: {
    system: string;
    historyText: string;
    userText: string;
  }): Promise<string> {
    if (!this.vectorStoreId) return OpenAiService.NO_KB_MESSAGE;

    const input = `${params.historyText}\n\nUsuario: ${params.userText}`.trim();

    const resp = await this.client.responses.create({
      model: this.model,
      instructions: params.system,
      input,
      temperature: 0.1,
      truncation: 'auto',
      tools: [
        {
          type: 'file_search',
          vector_store_ids: [this.vectorStoreId],
          max_num_results: 6,
        } as any,
      ] as any,
      include: ['file_search_call.results'] as any,
    });

    const raw = resp.output_text ?? '';
    const cleaned = this.removeDocumentReferences(raw);

    return cleaned || OpenAiService.NO_KB_MESSAGE;
  }

  // ===========================================================================
  // ✅ ASSISTANTS API (ENTELGY – CON THREAD PERSISTENTE)
  // ===========================================================================

  async replyWithAssistant(params: {
    assistantId: string;
    historyText: string;
    userText: string;
    threadId?: string | null;
  }): Promise<{ text: string; threadId: string }> {
    const { assistantId, historyText, userText } = params;

    // ✅ Thread seguro
    let threadId = (params.threadId ?? '').trim();

    if (!threadId) {
      const created = await this.client.beta.threads.create();
      threadId = created.id;
      this.logger.log(`Assistant: thread creado => ${threadId}`);
    } else {
      this.logger.log(`Assistant: reusando thread => ${threadId}`);
    }

    // ✅ Enviar mensaje
    const content = [
      historyText ? `HISTORIAL:\n${historyText}` : null,
      `MENSAJE USUARIO:\n${userText}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    await this.client.beta.threads.messages.create(threadId, {
      role: 'user',
      content,
    });

    // ✅ Crear run
    const run = await this.client.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    // ✅ Esperar run
    const finalRun = await this.waitRun(threadId, run.id);

    if (finalRun.status !== 'completed') {
      return { text: OpenAiService.NO_KB_MESSAGE, threadId };
    }

    // ✅ Obtener respuesta
    const msgs = await this.client.beta.threads.messages.list(threadId, { limit: 10 });
    const last = msgs.data.find((m) => m.role === 'assistant');

    const raw =
      this.extractAssistantText(last) ?? OpenAiService.NO_KB_MESSAGE;

    const clean = this.removeDocumentReferences(raw);

    return { text: clean, threadId };
  }

  // ===========================================================================
  // ✅ POLLING RUN
  // ===========================================================================

  private async waitRun(threadId: string, runId: string) {
    const timeoutMs = 25_000;
    const start = Date.now();

    while (true) {
      const run = await (this.client.beta.threads.runs.retrieve as any)(
        runId,
        { thread_id: threadId },
      );

      if (['completed', 'failed', 'cancelled', 'expired'].includes(run.status)) {
        return run;
      }

      if (Date.now() - start > timeoutMs) {
        return run;
      }

      await new Promise((r) => setTimeout(r, 700));
    }
  }

  // ===========================================================================
  // ✅ UTILIDADES
  // ===========================================================================

  private extractAssistantText(message: any): string | null {
    if (!message?.content?.length) return null;

    const first = message.content[0];
    if (first?.type === 'text') {
      return first.text?.value ?? null;
    }

    return null;
  }

  /**
   * 🚫 ELIMINA TODA REFERENCIA A DOCUMENTOS
   */
  private removeDocumentReferences(text: string): string {
    if (!text) return text;

    let cleaned = text;

    cleaned = cleaned.replace(/【[^】]*】/g, '');
    cleaned = cleaned.replace(/\[[^\]]*]/g, '');
    cleaned = cleaned.replace(/\([^)]*\.(pdf|docx|xlsx|pptx)\)/gi, '');

    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
  }
}
