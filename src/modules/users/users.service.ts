import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * UsersService
 * - Contiene reglas de negocio relacionadas a usuarios
 * - No maneja JWT (SRP)
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ✅ Busca usuario por email (para login y validación de duplicados)
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * ✅ Busca usuario por ID (completo)
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * ✅ Devuelve el perfil público del usuario (sin passwordHash)
   * Usado por: /auth/me, register, login
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
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * ✅ Lista pública de usuarios para el chat (sin passwordHash)
   * - Excluye al usuario logeado (currentUserId)
   * - Ordena por displayName asc para UX tipo WhatsApp
   */
  async findAllPublic(currentUserId: string) {
    return this.prisma.user.findMany({
      where: {
        id: { not: currentUserId }, // ✅ excluye al usuario actual
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        phone: true,
        companySection: true,
        jobTitle: true,
        createdAt: true,
      },
      orderBy: {
        displayName: 'asc',
      },
    });
  }

  /**
   * ✅ Crea usuario con campos extendidos (corporativos)
   * - Valida duplicidad por email
   */
  async createUser(params: {
    email: string;
    displayName: string;
    passwordHash: string;
    phone?: string | null;
    companySection?: string | null;
    jobTitle?: string | null;
  }) {
    const existing = await this.findByEmail(params.email);
    if (existing) throw new ConflictException('Email already in use');

    return this.prisma.user.create({
      data: {
        email: params.email,
        displayName: params.displayName,
        passwordHash: params.passwordHash,
        phone: params.phone ?? null,
        companySection: params.companySection ?? null,
        jobTitle: params.jobTitle ?? null,
      },
    });
  }

  /**
   * ✅ Actualiza el hash del refresh token (para rotación/revocación)
   */
  async updateRefreshTokenHash(userId: string, refreshTokenHash: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }
}
