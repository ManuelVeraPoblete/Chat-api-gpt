import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

class EnvVars {
  @IsString()
  @IsNotEmpty()
  NODE_ENV!: string;

  @IsInt()
  @Min(1)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsInt()
  @Min(60)
  JWT_ACCESS_TTL_SECONDS!: number;

  @IsInt()
  @Min(60)
  JWT_REFRESH_TTL_SECONDS!: number;

  @IsInt()
  @Min(8)
  BCRYPT_SALT_ROUNDS!: number;

  /**
   *  MongoDB connection string
   * Ej: mongodb://localhost:27017/corpchat
   */
  @IsString()
  @IsNotEmpty()
  MONGO_URI!: string;

  /**
   *  OpenAI key (solo backend)
   */
  @IsString()
  @IsNotEmpty()
  OPENAI_API_KEY!: string;

  /**
   *  OpenAI model (opcional)
   * Ej: gpt-4o-mini
   */
  @IsString()
  @IsOptional()
  OPENAI_MODEL?: string;

  /**
   *  UUID del usuario "Asistente Corporativo" en tu BD
   */
  @IsString()
  @IsNotEmpty()
  ASSISTANT_USER_ID!: string;
}

/**
 * Valida variables de entorno al iniciar la app.
 * Si falla, se corta el arranque (fail fast).
 */
export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, {
    ...config,
    PORT: Number(config.PORT),
    JWT_ACCESS_TTL_SECONDS: Number(config.JWT_ACCESS_TTL_SECONDS),
    JWT_REFRESH_TTL_SECONDS: Number(config.JWT_REFRESH_TTL_SECONDS),
    BCRYPT_SALT_ROUNDS: Number(config.BCRYPT_SALT_ROUNDS),
  });

  const errors = validateSync(validated, { whitelist: true });
  if (errors.length) {
    const messages = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join(' | ');
    throw new Error(`ENV validation error: ${messages}`);
  }
  return validated;
}
