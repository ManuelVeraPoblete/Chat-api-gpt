// src/modules/workday/workday.controller.ts

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { WorkdayService } from './workday.service';
import type { WorkdayDto } from './dto/workday.dto';

/**
 *  Request autenticado
 * Passport (JWT) inyecta `req.user`.
 */
type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    sub?: string;
    userId?: string;
  };
};

@Controller('workday')
@UseGuards(AuthGuard('jwt'))
export class WorkdayController {
  constructor(private readonly workdayService: WorkdayService) {}

  /**
   * ✅ Helper: obtiene userId desde el JWT
   * Soporta distintos claims típicos (id/sub/userId) para compatibilidad.
   */
  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.sub ?? req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('No se pudo identificar al usuario autenticado.');
    }
    return userId;
  }

  /**
   * ✅ Obtiene el workday del usuario autenticado para el día de hoy (Chile).
   */
  @Get('today')
  async getMyToday(@Req() req: AuthenticatedRequest): Promise<WorkdayDto> {
    const userId = this.getUserId(req);
    return this.workdayService.getTodayByUserId(userId);
  }
  
  /**
   * ✅ Reset / recuperación
   * Fuerza el estado a ACTIVE cerrando intervalos abiertos (tolerancia a errores humanos).
   */
  @Post('reset')
  async reset(@Req() req: AuthenticatedRequest): Promise<WorkdayDto> {
    const userId = this.getUserId(req);
    return this.workdayService.reset(userId);
  }

  /**
   * ✅ Marca inicio de jornada (Entrada)
   */
  @Post('start')
  async start(@Req() req: AuthenticatedRequest): Promise<WorkdayDto> {
    const userId = this.getUserId(req);
    return this.workdayService.start(userId);
  }

  /**
   * ✅ Marca usuario Activo (Reiniciar desde pausa/almuerzo)
   */
  @Post('active')
  async setActive(@Req() req: AuthenticatedRequest): Promise<WorkdayDto> {
    const userId = this.getUserId(req);
    return this.workdayService.setActive(userId);
  }

  /**
   * ✅ Marca Pausa
   */
  @Post('pause')
  async pause(@Req() req: AuthenticatedRequest): Promise<WorkdayDto> {
    const userId = this.getUserId(req);
    return this.workdayService.pause(userId);
  }

  /**
   * ✅ Marca Almuerzo / Colación
   */
  @Post('lunch')
  async lunch(@Req() req: AuthenticatedRequest): Promise<WorkdayDto> {
    const userId = this.getUserId(req);
    return this.workdayService.lunch(userId);
  }

  /**
   * ✅ Marca término de jornada (Desconexión)
   */
  @Post('end')
  async end(@Req() req: AuthenticatedRequest): Promise<WorkdayDto> {
    const userId = this.getUserId(req);
    return this.workdayService.end(userId);
  }

  // ---------------------------------------------------------------------------
  // ✅ NUEVOS ENDPOINTS para pintar estados de otros usuarios en el Front
  // ---------------------------------------------------------------------------

  /**
   * ✅ Obtiene el workday "hoy" (Chile) para un usuario específico.
   * Útil si quieres ver el estado de un usuario puntual.
   */
  @Get('user/:userId/today')
  async getUserToday(@Param('userId') userId: string): Promise<WorkdayDto> {
    return this.workdayService.getTodayByUserId(userId);
  }

  /**
   * ✅ Obtiene estados "hoy" (Chile) en masa para una lista de userIds.
   *
   * Body:
   *  {
   *    "userIds": ["uuid1", "uuid2", ...]
   *  }
   *
   * Response:
   *  {
   *    "uuid1": { ...WorkdayDto },
   *    "uuid2": { ...WorkdayDto }
   *  }
   */
  @Post('today/statuses')
  async getTodayStatuses(
    @Body() body: { userIds: string[] },
  ): Promise<Record<string, WorkdayDto>> {
    return this.workdayService.getTodayStatuses(body?.userIds ?? []);
  }
}
