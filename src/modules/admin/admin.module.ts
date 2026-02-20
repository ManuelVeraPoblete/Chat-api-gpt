import { Module } from '@nestjs/common';
import { AdminLogsModule } from './logsapi/admin-logs.module';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    AdminLogsModule,
    UsersModule, // ✅ para poder usar UsersService en bootstrap
  ],
  providers: [AdminBootstrapService],
})
export class AdminModule {}
