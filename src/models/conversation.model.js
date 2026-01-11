// src/models/conversation.model.js
// Modelo de conversaciones con historial persistente.

import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    role: { type: String, required: true, enum: ["user", "assistant", "system"] },
    content: { type: String, required: true },
    at: { type: Date, default: Date.now }, // fecha del mensaje
  },
  { _id: false }
);

const ConversationSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, unique: true, index: true },
    model: { type: String, default: "gpt-4.1-mini" },
    messages: { type: [MessageSchema], default: [] },
  },
  {
    timestamps: true, // crea createdAt y updatedAt automáticamente
  }
);

export default mongoose.model("Conversation", ConversationSchema);
