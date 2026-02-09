// src/common/logging/logger.factory.ts
import * as fs from 'fs';
import * as path from 'path';

import pino, { LoggerOptions } from 'pino';
import { multistream } from 'pino-multi-stream';

/**
 *  Logger Pino:
 * - Consola (pretty en dev)
 * - Archivo (siempre)
 *
 * Nota TS:
 * - Usamos `import * as fs/path` para evitar `undefined` cuando esModuleInterop=false
 */
export function createAppLogger() {
  const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
  const logLevel = process.env.LOG_LEVEL || 'info';
  const serviceName = process.env.SERVICE_NAME || 'corpchat-api';
  const nodeEnv = process.env.NODE_ENV || 'development';

  //  Crea carpeta si no existe
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const filePath = path.join(logDir, 'app.log');
  const fileStream = fs.createWriteStream(filePath, { flags: 'a' });

  const isDev = nodeEnv !== 'production';

  const options: LoggerOptions = {
    level: logLevel,
    base: { service: serviceName },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  const streams = [
    {
      level: logLevel,
      stream: isDev
        ? //  Pretty SOLO en consola para desarrollo
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require('pino-pretty')({
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          })
        : process.stdout,
    },
    {
      level: logLevel,
      stream: fileStream,
    },
  ];

  return pino(options, multistream(streams as any));
}
