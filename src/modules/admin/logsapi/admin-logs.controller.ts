import { Controller, Get, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AdminLogsService } from './admin-logs.service';
import { AdminLogsQueryDto } from './dto/admin-logs-query.dto';
import { AdminLogsResponseDto } from './dto/admin-logs-response.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

/**
 * AdminLogsController
 * - Validación + transform habilitados para que:
 *   - "" => undefined (por @Transform)
 *   - page/size/tail se transformen a number
 */
@Controller('admin/logs')
@UseGuards(JwtAuthGuard)
export class AdminLogsController {
  constructor(private readonly service: AdminLogsService) {}

  @Get()
  @UsePipes(
    new ValidationPipe({
      transform: true,       // ✅ necesario para class-transformer
      whitelist: true,       // ✅ limpia params no esperados
      forbidNonWhitelisted: false,
    }),
  )
  async getLogs(@Query() query: AdminLogsQueryDto): Promise<AdminLogsResponseDto> {
    return this.service.getLogs(query);
  }
}
