// src/repositories/conversation.repository.js
// Repositorio Mongo para conversaciones.

import Conversation from "../models/conversation.model.js";

export async function getHistory(conversationId, limit = 40) {
  const doc = await Conversation.findOne({ conversationId }).lean();
  if (!doc?.messages?.length) return [];
  return doc.messages.slice(Math.max(0, doc.messages.length - limit));
}

export async function appendMessages({ conversationId, model, messages }) {
  const normalized = (messages ?? []).map((m) => ({
    role: m.role,
    content: m.content,
    at: new Date(),
  }));

  await Conversation.updateOne(
    { conversationId },
    {
      $setOnInsert: { conversationId },
      $set: { model },
      $push: { messages: { $each: normalized } },
      $currentDate: { updatedAt: true },
    },
    { upsert: true }
  );
}

export async function getConversation(conversationId) {
  return Conversation.findOne({ conversationId }).lean();
}

/**
 * Lista resumida (para sidebar)
 */
export async function listConversations(limit = 20) {
  const docs = await Conversation.find({})
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select({ conversationId: 1, model: 1, updatedAt: 1, messages: 1 })
    .lean();

  return docs.map((d) => {
    const last = d.messages?.length ? d.messages[d.messages.length - 1] : null;
    return {
      conversationId: d.conversationId,
      model: d.model ?? null,
      updatedAt: d.updatedAt ?? null,
      preview: last?.content ? String(last.content).slice(0, 120) : "",
      totalMessages: d.messages?.length ?? 0,
    };
  });
}

/**
 * Lista con últimos N mensajes por conversación (para “reiniciar chat” mostrando contexto).
 * Ojo: esto es más pesado que el resumen.
 */
export async function listConversationsWithMessages(limit = 20, messagesLimit = 20) {
  const docs = await Conversation.find({})
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select({ conversationId: 1, model: 1, updatedAt: 1, messages: 1 })
    .lean();

  return docs.map((d) => {
    const all = d.messages ?? [];
    const lastN = all.slice(Math.max(0, all.length - messagesLimit));

    const last = all.length ? all[all.length - 1] : null;

    return {
      conversationId: d.conversationId,
      model: d.model ?? null,
      updatedAt: d.updatedAt ?? null,
      preview: last?.content ? String(last.content).slice(0, 120) : "",
      totalMessages: all.length,
      messages: lastN, // ✅ últimos N mensajes
    };
  });
}
