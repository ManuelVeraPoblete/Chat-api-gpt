import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';

/**
 * ✅ Bootstrap principal de la API
 * - enableShutdownHooks(): permite cerrar Prisma/Mongo correctamente al apagar la app
 * - listen en 0.0.0.0: permite acceder desde Postman / celular / emulador si expones puerto
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /**
   * ✅ Validaciones globales
   * - whitelist: elimina campos extra (seguridad)
   * - transform: castea tipos automáticamente
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // ✅ Errores de Upload claros (Multer)
  app.useGlobalFilters(new MulterExceptionFilter());

  /**
   * ✅ Servir archivos subidos públicamente
   * - URL pública: /uploads/...
   * - Ruta física: <projectRoot>/uploads
   */
  const uploadsRoot = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsRoot));

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
