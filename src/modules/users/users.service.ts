import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * UsersService
 * ✅ Reglas de negocio relacionadas a usuarios (SRP)
 * ✅ Auth usa este servicio, pero el servicio NO maneja JWT
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ✅ Usado por Auth en login/register
   * Retorna el usuario completo (incluye passwordHash)
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * ✅ Obtiene un usuario por ID (completo)
   * Útil para lógica interna
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * ✅ Obtiene un usuario "público" por ID
   * - No expone passwordHash ni refreshTokenHash
   * - Ideal para detalles del usuario en UI
   */
  async findPublicById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        displayName: true,
        phone: true,
        companySection: true,
        jobTitle: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * ✅ Lista pública de usuarios (para pantalla de chat)
   * - No expone passwordHash ni refreshTokenHash
   * - Excluye al usuario autenticado si se entrega currentUserId
   */
  async findAllPublic(currentUserId?: string) {
    return this.prisma.user.findMany({
      where: currentUserId
        ? {
            id: { not: currentUserId }, // ✅ no incluir al usuario logeado
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        phone: true,
        companySection: true,
        jobTitle: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * ✅ Crea usuario
   * - Valida email único
   * - Soporta campos opcionales según tu BD
   */
  async createUser(params: {
    email: string;
    displayName: string;
    passwordHash: string;

    // ✅ Opcionales según tu tabla MySQL
    phone?: string | null;
    companySection?: string | null;
    jobTitle?: string | null;
    status?: UserStatus;
  }) {
    const existing = await this.findByEmail(params.email);
    if (existing) throw new ConflictException('Email already in use');

    return this.prisma.user.create({
      data: {
        email: params.email,
        displayName: params.displayName,
        passwordHash: params.passwordHash,

        // ✅ extras opcionales
        phone: params.phone ?? null,
        companySection: params.companySection ?? null,
        jobTitle: params.jobTitle ?? null,

        status: params.status ?? UserStatus.ACTIVE,
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
}
