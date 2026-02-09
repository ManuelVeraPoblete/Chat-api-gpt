import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

/**
 * UsersController
 * - Expone endpoints REST relacionados a usuarios
 * - Sin lógica de negocio (solo delega al service)
 */
@Controller('users') //  /users
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   *  Ping público
   * GET /users/ping
   */
  @Get('ping')
  ping() {
    return { ok: true, message: 'UsersController OK ' };
  }

  /**
   *  Lista usuarios para chat (tipo WhatsApp)
   * GET /users
   *
   * - Protegido con JWT
   * - Excluye al usuario logeado
   */
  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAll(@Req() req: any) {
    const currentUserId: string | undefined = req?.user?.userId;

    if (!currentUserId) {
      throw new UnauthorizedException('Invalid token: userId missing');
    }

    return this.usersService.findAllPublic(currentUserId);
  }

  /**
   *  Perfil público por ID (el que te faltaba)
   * GET /users/:id
   *
   * - Protegido con JWT
   * - Retorna datos seguros (sin passwordHash)
   */
  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  async findPublicById(@Param('id') id: string) {
    return this.usersService.findPublicById(id);
  }
}
