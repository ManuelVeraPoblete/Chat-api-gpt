
import { Module } from '@nestjs/common';
import { AdminLogsController } from './admin-logs.controller';
import { AdminLogsService } from './admin-logs.service';

/**
 * AdminLogsModule
 * - Expone /admin/logs
 * - SRP: sólo administración de logs
 */
@Module({
  controllers: [AdminLogsController],
  providers: [AdminLogsService],
})
export class AdminLogsModule {}
