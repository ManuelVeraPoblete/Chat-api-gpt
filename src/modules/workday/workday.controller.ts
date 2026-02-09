// src/modules/workday/workday.controller.ts

import { Controller, Get, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { WorkdayService } from './workday.service';
import type { WorkdayDto } from './dto/workday.dto';

/**
 *  Request autenticado
 * Passport deja el payload del JWT en req.user.
 */
type AuthRequest = Request & {
  user?: {
    sub?: string;
    id?: string;
    userId?: string;
    email?: string;
  };
};

@Controller('workday')
@UseGuards(AuthGuard('jwt'))
export class WorkdayController {
  constructor(private readonly workdayService: WorkdayService) {}

  /**
   *  Extrae el userId del request (sub/id/userId)
   * Mantiene compatibilidad con distintas estrategias/payloads.
   */
  private getUserId(req: AuthRequest): string {
    const userId = req.user?.sub ?? req.user?.id ?? req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException(
        'JWT válido pero sin identificador de usuario (req.user.sub | req.user.id | req.user.userId)',
      );
    }

    return userId;
  }

  /**
   *  GET /workday/today
   * Retorna el estado de jornada del día.
   * - Si no existe aún, retorna NOT_STARTED (sin persistir).
   */
  @Get('today')
  async today(@Req() req: AuthRequest): Promise<WorkdayDto> {
    const userId = this.getUserId(req);
    return this.workdayService.getToday(userId);
  }

  /**
   *  POST /workday/start
   * Marca entrada y deja la jornada ACTIVE.
   */
  @Post('start')
  async start(@Req() req: AuthRequest): Promise<WorkdayDto> {
    const userId = this.getUserId(req);
    return this.workdayService.start(userId);
  }

  /**
   *  POST /workday/active
   * Reanuda trabajo (vuelve a ACTIVE).
   * - Útil cuando vienes de PAUSED o LUNCH.
   */
  @Post('active')
  async active(@Req() req: AuthRequest): Promise<WorkdayDto> {
    const userId = this.getUserId(req);
    return this.workdayService.setActive(userId);
  }

  /**
   *  POST /workday/pause
   * Marca inicio de pausa.
   */
  @Post('pause')
  async pause(@Req() req: AuthRequest): Promise<WorkdayDto> {
    const userId = this.getUserId(req);
    return this.workdayService.pause(userId);
  }

  /**
   *  POST /workday/lunch
   * Marca inicio de colación.
   */
  @Post('lunch')
  async lunch(@Req() req: AuthRequest): Promise<WorkdayDto> {
    const userId = this.getUserId(req);
    return this.workdayService.lunch(userId);
  }

  /**
   *  POST /workday/end
   * Marca desconexión/salida.
   */
  @Post('end')
  async end(@Req() req: AuthRequest): Promise<WorkdayDto> {
    const userId = this.getUserId(req);
    return this.workdayService.end(userId);
  }
}
