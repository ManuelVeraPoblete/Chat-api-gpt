import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard reutilizable: separa concerns (OCP).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
