import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { LocationsService } from './locations.service';
import { UpdateLocationDto } from './dto/update-location.dto';

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

@Controller('locations')
@UseGuards(AuthGuard('jwt'))
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /**
   *  Extrae el userId del request (sub/id/userId)
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
   *  POST /locations/me
   * Body: { latitude, longitude, accuracy?, isLive?, liveMinutes? }
   */
  @Post('me')
  async updateMyLocation(@Req() req: AuthRequest, @Body() dto: UpdateLocationDto) {
    const userId = this.getUserId(req);
    return this.locationsService.upsertMyLocation(userId, dto);
  }

  /**
   *  DELETE /locations/me
   * Detiene compartir ubicación live
   */
  @Delete('me')
  async stopSharing(@Req() req: AuthRequest) {
    const userId = this.getUserId(req);
    return this.locationsService.stopSharing(userId);
  }

  /**
   *  GET /locations/active?maxAgeSeconds=120
   * Lista usuarios conectados/activos con ubicación reciente.
   */
  @Get('active')
  async getActive(@Query('maxAgeSeconds') maxAgeSeconds?: string) {
    const parsed = maxAgeSeconds ? Number(maxAgeSeconds) : 120;
    return this.locationsService.getActiveLocations(parsed);
  }
}
