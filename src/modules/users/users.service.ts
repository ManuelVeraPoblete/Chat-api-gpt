import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * UsersService
 *  Reglas de negocio relacionadas a usuarios (SRP)
 *  Auth usa este servicio, pero el servicio NO maneja JWT
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

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
        role: true, // ✅ NUEVO
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findAllPublic(currentUserId?: string) {
    return this.prisma.user.findMany({
      where: currentUserId
        ? {
            id: { not: currentUserId },
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
        role: true, // ✅ NUEVO
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   *  Crea usuario
   * - Valida email único
   * - Soporta role ADMIN para dashboard
   */
  async createUser(params: {
    email: string;
    displayName: string;
    passwordHash: string;

    phone?: string | null;
    companySection?: string | null;
    jobTitle?: string | null;
    status?: UserStatus;

    role?: UserRole; // ✅ NUEVO
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

        status: params.status ?? UserStatus.ACTIVE,
        role: params.role ?? UserRole.USER, // ✅ NUEVO
      },
    });
  }

  async updateRefreshTokenHash(userId: string, refreshTokenHash: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }
}
