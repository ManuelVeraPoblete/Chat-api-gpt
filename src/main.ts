import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /**
   * ✅ Pipes globales (recomendado)
   * - whitelist: elimina campos no permitidos
   * - transform: castea query params, etc.
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  /**
   * ✅ CORS (para web / emulator / mobile)
   */
  app.enableCors({
    origin: true,
    credentials: true,
  });

  /**
   * ✅ Servir archivos estáticos:
   * - Carpeta: /uploads
   * - URL pública: http://host:3000/uploads/...
   *
   * Esto habilita:
   * - /uploads/chat/<filename>
   */
  const uploadsPath = join(process.cwd(), 'uploads');

  // ✅ Asegura que exista la carpeta base para evitar errores
  if (!existsSync(uploadsPath)) {
    mkdirSync(uploadsPath, { recursive: true });
  }

  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads',
  });

  /**
   * ✅ Puerto
   */
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, '0.0.0.0'); // ✅ IMPORTANTE para Android físico

  console.log(`✅ API corriendo en http://0.0.0.0:${port}`);
}

bootstrap();
