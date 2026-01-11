// src/openai/client.js
// Cliente centralizado de OpenAI (SDK oficial)

import OpenAI from "openai";

export function buildOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // Falla rápida: evita levantar el servidor sin credenciales
    throw new Error("OPENAI_API_KEY no está configurada");
  }

  // El SDK oficial usa la variable apiKey para autenticar las requests. :contentReference[oaicite:3]{index=3}
  return new OpenAI({ apiKey });
}
