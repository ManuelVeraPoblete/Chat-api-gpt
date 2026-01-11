// src/middleware/validate.js
// Middleware genérico para validar payloads con Zod.

export function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Body inválido",
        errors: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message
        }))
      });
    }

    // Guardamos el body validado (tipado/limpio) para el handler
    req.validatedBody = parsed.data;
    next();
  };
}
