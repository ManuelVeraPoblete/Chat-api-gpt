import { Controller, Get, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AdminLogsService } from './admin-logs.service';
import { AdminLogsQueryDto } from './dto/admin-logs-query.dto';
import { AdminLogsResponseDto } from './dto/admin-logs-response.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('admin/logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminLogsController {
  constructor(private readonly service: AdminLogsService) {}

  @Get()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  )
  async getLogs(@Query() query: AdminLogsQueryDto): Promise<AdminLogsResponseDto> {
    return this.service.getLogs(query);
  }
}
