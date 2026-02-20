import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Decorator Roles
 * - Define roles requeridos por handler
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
