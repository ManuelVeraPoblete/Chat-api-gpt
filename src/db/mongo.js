// src/db/mongo.js
// Conexión centralizada a MongoDB con Mongoose (ESM)

import mongoose from "mongoose";

/**
 * Conecta a MongoDB usando MONGODB_URI.
 * Buenas prácticas:
 * - fail fast si no hay URI
 * - log claro de conexión
 */
export async function connectMongo() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI no está configurada");
  }

  // Evita reconectar si ya hay conexión activa
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    // options modernas; mongoose las maneja internamente
  });

  console.log("[MongoDB] Conectado OK");
  return mongoose.connection;
}
