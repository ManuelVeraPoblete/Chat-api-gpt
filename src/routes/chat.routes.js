// src/routes/chat.routes.js
// Endpoints:
// - POST /api/chat        -> respuesta JSON completa
// - POST /api/chat/stream -> respuesta streaming (SSE)
// Historial: MongoDB (persistente) usando ConversationRepository.

import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";

import { validateBody } from "../middleware/validate.js";
import { buildOpenAIClient } from "../openai/client.js";
import { getHistory, appendMessages } from "../repositories/conversation.repository.js";

const router = Router();
const openai = buildOpenAIClient();

// Esquema de entrada: message requerido; conversationId opcional
const chatSchema = z.object({
  message: z.string().min(1).max(8000),
  conversationId: z.string().optional(),
});

/**
 * Normaliza conversationId:
 * - Si el cliente NO manda uno, generamos uno nuevo.
 * - Así siempre podemos persistir historial.
 */
function resolveConversationId(maybeId) {
  return maybeId && maybeId.trim().length > 0 ? maybeId.trim() : crypto.randomUUID();
}

/**
 * POST /api/chat
 * Respuesta completa (no streaming)
 */
router.post("/chat", validateBody(chatSchema), async (req, res, next) => {
  try {
    const { message, conversationId: maybeConversationId } = req.validatedBody;

    const conversationId = resolveConversationId(maybeConversationId);

    // Traemos historial reciente para armar el prompt
    const history = await getHistory(conversationId, 40);

    // Guardamos el mensaje del usuario en Mongo
    await appendMessages({
      conversationId,
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: [{ role: "user", content: message }],
    });

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    // Prompt simple: historial + mensaje actual
    const inputText = [
      ...history.map((m) => `${m.role.toUpperCase()}: ${m.content}`),
      `USER: ${message}`,
    ].join("\n");

    const response = await openai.responses.create({
      model,
      input: inputText,
    });

    // Texto final
    const outputText = response.output_text || "";

    // Guardamos respuesta del asistente en Mongo
    await appendMessages({
      conversationId,
      model,
      messages: [{ role: "assistant", content: outputText }],
    });

    res.json({
      conversationId,
      model,
      answer: outputText,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/chat/stream
 * Streaming por SSE (Server-Sent Events)
 */
router.post("/chat/stream", validateBody(chatSchema), async (req, res, next) => {
  try {
    const { message, conversationId: maybeConversationId } = req.validatedBody;

    const conversationId = resolveConversationId(maybeConversationId);
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    // Historial reciente desde Mongo
    const history = await getHistory(conversationId, 40);

    // Persistimos de inmediato el mensaje del usuario
    await appendMessages({
      conversationId,
      model,
      messages: [{ role: "user", content: message }],
    });

    // Prompt simple: historial + mensaje actual
    const inputText = [
      ...history.map((m) => `${m.role.toUpperCase()}: ${m.content}`),
      `USER: ${message}`,
    ].join("\n");

    // Headers SSE
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    // Helper SSE
    const sendEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Enviamos metadata inicial
    sendEvent("meta", { conversationId, model });

    let fullText = "";

    // Stream OpenAI
    const stream = await openai.responses.create({
      model,
      input: inputText,
      stream: true,
    });

    for await (const event of stream) {
      // Delta de texto
      if (event.type === "response.output_text.delta") {
        const delta = event.delta || "";
        fullText += delta;
        sendEvent("delta", { delta });
      }

      // Finalización
      if (event.type === "response.completed") {
        sendEvent("done", { ok: true });
      }
    }

    // Persistimos respuesta completa al final (evita escribir token por token)
    await appendMessages({
      conversationId,
      model,
      messages: [{ role: "assistant", content: fullText }],
    });

    res.end();
  } catch (err) {
    next(err);
  }
});

export default router;
