import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';import 'dotenv/config';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validación global (DTOs)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // CORS (para React Native)
  app.enableCors({
    origin: true,
    credentials: false,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3000;

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`✅ API running on http://localhost:${port}`);
}
bootstrap();
