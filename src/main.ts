import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * ✅ Bootstrap principal de la API
 * - enableShutdownHooks(): permite cerrar Prisma/Mongo correctamente al apagar la app
 * - listen en 0.0.0.0: permite acceder desde Postman / celular / emulador si expones puerto
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Cierre correcto (PrismaService implementa OnModuleDestroy)
  app.enableShutdownHooks();

  // ✅ (Opcional) habilitar CORS si tu frontend lo necesita
  app.enableCors({
    origin: true, // permite cualquier origen en dev
    credentials: true,
  });

  const port = Number(process.env.PORT || 3000);

  await app.listen(port, '0.0.0.0');

  // ✅ log amigable
  console.log(`✅ API running on http://localhost:${port}`);
}

bootstrap();
