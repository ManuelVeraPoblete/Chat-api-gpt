/**
 * ✅ Prisma 7 Config (OBLIGATORIO)
 * - Prisma 7 ya no usa `url = env(...)` dentro de schema.prisma
 * - La URL de conexión se define aquí usando `datasource.url`
 * - Cargamos variables del .env manualmente con dotenv
 */
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // ✅ Ruta del schema oficial
  schema: 'prisma/schema.prisma',

  // ✅ URL de conexión a MySQL (desde .env)
  datasource: {
    url: env('DATABASE_URL'),
  },
});
