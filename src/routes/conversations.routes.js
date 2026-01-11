// src/routes/conversations.routes.js
// - GET /api/conversations?limit=20&messagesLimit=0|20
// - GET /api/conversations/:conversationId

import { Router } from "express";
import { z } from "zod";
import {
  listConversations,
  listConversationsWithMessages,
  getConversation,
} from "../repositories/conversation.repository.js";

const router = Router();

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  messagesLimit: z.coerce.number().int().min(0).max(200).optional(),
});

/**
 * GET /api/conversations
 * - Por defecto: lista resumida (preview)
 * - Si messagesLimit > 0: incluye últimos N mensajes por conversación
 */
router.get("/conversations", async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    const limit = parsed.success ? parsed.data.limit ?? 20 : 20;
    const messagesLimit = parsed.success ? parsed.data.messagesLimit ?? 0 : 0;

    const items =
      messagesLimit > 0
        ? await listConversationsWithMessages(limit, messagesLimit)
        : await listConversations(limit);

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/conversations/:conversationId
 * Devuelve la conversación completa (todos los mensajes)
 */
router.get("/conversations/:conversationId", async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    const conversation = await getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    res.json(conversation);
  } catch (err) {
    next(err);
  }
});

export default router;
