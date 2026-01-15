import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * UsersService: reglas de negocio relacionadas a usuarios.
 * No maneja JWT ni auth: SRP.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ✅ Usado por Auth/Login (necesita passwordHash internamente)
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * ✅ Busca usuario por id
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * ✅ Crea usuario
   */
  async createUser(params: { email: string; displayName: string; passwordHash: string }) {
    const existing = await this.findByEmail(params.email);
    if (existing) throw new ConflictException('Email already in use');

    return this.prisma.user.create({
      data: {
        email: params.email,
        displayName: params.displayName,
        passwordHash: params.passwordHash,
      },
    });
  }

  /**
   * ✅ Actualiza hash del refresh token (seguridad)
   */
  async updateRefreshTokenHash(userId: string, refreshTokenHash: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  /**
   * ✅ Lista de usuarios pública (para chat)
   * - NO expone passwordHash ni refreshTokenHash
   * - Excluye al usuario logeado
   */
  async findAllPublic(currentUserId?: string) {
    return this.prisma.user.findMany({
      where: currentUserId
        ? {
            id: { not: currentUserId }, // ✅ no me incluyo en la lista
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
    });
  }
}
