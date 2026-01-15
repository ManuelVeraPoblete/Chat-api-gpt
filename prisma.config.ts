/**
 * Prisma 7 config:
 * - La URL de conexión para CLI (migrate/db push/studio) se define aquí,
 *   NO dentro del datasource en schema.prisma.
 * - Prisma 7 NO carga env vars automáticamente, por eso importamos dotenv/config.
 */
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // ✅ Apunta a tu schema REAL (lo tienes dentro de src/)
  schema: 'src/modules/prisma/schema.prisma',

  // ✅ URL para Prisma CLI (migrate, db push, studio)
  datasource: {
    url: process.env.DATABASE_URL!,
  },

  // (Opcional) si usas migrate dev con shadow database:
  // datasource: {
  //   url: process.env.DATABASE_URL!,
  //   shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL!,
  // },
});
