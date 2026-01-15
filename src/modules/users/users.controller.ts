import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

/**
 * Controller público de usuarios.
 * - Expone endpoints REST
 * - No contiene lógica de negocio (solo delega al service)
 */
@Controller('users') // ✅ /users
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * ✅ Endpoint simple para verificar que el controller está mapeado
   * GET /users/ping
   */
  @Get('ping')
  ping() {
    return { ok: true, message: 'UsersController OK ✅' };
  }

  /**
   * ✅ Lista usuarios para chat (tipo WhatsApp)
   * GET /users
   *
   * - Protegido con JWT
   * - Retorna datos seguros (sin hashes)
   * - Excluye el usuario logeado (opcional pero recomendado)
   */
  @UseGuards(AuthGuard('jwt'))
  @Get()
  async findAll(@Req() req: any) {
    const currentUserId: string | undefined = req?.user?.sub; // viene del JWT payload
    return this.usersService.findAllPublic(currentUserId);
  }
}
