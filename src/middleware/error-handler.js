// src/middleware/error-handler.js
// Manejador centralizado de errores para respuestas consistentes.

export function errorHandler(err, req, res, next) {
  // Log mínimo del error (en prod usarías un logger estructurado)
  console.error("[ERROR]", err);

  // Evita filtrar detalles sensibles al cliente
  res.status(500).json({
    message: "Internal Server Error"
  });
}
