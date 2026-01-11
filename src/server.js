// src/server.js
// API Express con buenas prácticas básicas: seguridad, CORS, rate limit, healthcheck.
// + Conexión a MongoDB al arranque (historial persistente).

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import chatRoutes from "./routes/chat.routes.js";
import conversationsRoutes from "./routes/conversations.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { connectMongo } from "./db/mongo.js";

const app = express();

// Seguridad HTTP headers
app.use(helmet());

// JSON body
app.use(express.json({ limit: "1mb" }));

// CORS controlado (ajusta a tu front)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? "*",
  })
);

// Rate limit básico (anti abuso)
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const max = Number(process.env.RATE_LIMIT_MAX ?? 60);

app.use(
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Healthcheck
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api", chatRoutes);
app.use("/api", conversationsRoutes);

// Error handler al final
app.use(errorHandler);

/**
 * Arranque controlado:
 * - Conecta a Mongo antes de escuchar (fail fast si no hay DB)
 */
async function bootstrap() {
  // Conecta a MongoDB (requerido para historial)
  await connectMongo();

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`Chat API escuchando en http://localhost:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error("❌ Error al iniciar la API:", err);
  process.exit(1);
});
