import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { CryptoUtil } from '../../common/util/crypto.util';

/**
 * AdminBootstrapService
 * - Crea un usuario ADMIN para dashboard si no existe
 * - Se controla por .env (ADMIN_EMAIL / ADMIN_PASSWORD)
 *
 * Resiliencia:
 * - Si DB no está migrada o faltan tablas, NO debe botar la app.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config.get<string>('ADMIN_EMAIL');
    const password = this.config.get<string>('ADMIN_PASSWORD');
    const displayName = this.config.get<string>('ADMIN_DISPLAY_NAME') ?? 'Admin Dashboard';

    if (!email || !password) {
      this.logger.warn('ADMIN_EMAIL/ADMIN_PASSWORD no configurados. No se creará usuario admin.');
      return;
    }

    try {
      const existing = await this.users.findByEmail(email);
      if (existing) {
        this.logger.log(`Usuario ADMIN ya existe: ${email}`);
        return;
      }

      const saltRounds = Number(this.config.get<number>('security.bcryptSaltRounds'));
      const passwordHash = await CryptoUtil.hash(password, saltRounds);

      await this.users.createUser({
        email,
        displayName,
        passwordHash,
        role: UserRole.ADMIN,
      });

      this.logger.log(`✅ Usuario ADMIN creado para dashboard: ${email}`);
    } catch (err: any) {
      /**
       * Prisma P2021: Table does not exist
       * - En tu caso: "corpchat.User doesn't exist"
       * - No botamos la app: dejamos el log con la acción correcta.
       */
      const message = String(err?.message ?? err);
      const code = err?.code;

      this.logger.error(
        {
          type: 'admin_bootstrap_error',
          prismaCode: code,
          message,
        },
        'No se pudo ejecutar AdminBootstrapService. Probablemente faltan migraciones/tablas.',
      );

      this.logger.warn(
        [
          'Acción sugerida:',
          '- Verifica que el @prisma/client esté generado con el schema correcto (con @@map("user")).',
          '- Ejecuta migraciones o db push para crear tablas.',
        ].join('\n'),
      );

      // ✅ No re-lanzamos el error: NO botamos la API.
      return;
    }
  }
}
