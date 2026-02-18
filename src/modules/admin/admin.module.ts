import { Module } from '@nestjs/common';
import { AdminLogsModule } from './logsapi/admin-logs.module';

/**
 * AdminModule
 * - Agrupa features administrativas (Logs, métricas, etc.)
 * - Mantiene el AppModule limpio (Clean Code)
 */
@Module({
  imports: [AdminLogsModule],
})
export class AdminModule {}
