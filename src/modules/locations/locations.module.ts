import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { UserLocation, UserLocationSchema } from './schemas/user-location.schema';

/**
 *  LocationsModule
 *
 * Responsabilidad:
 * - Administrar ubicación de usuarios conectados (opt-in).
 * - CRUD mínimo:
 *   - actualizar mi ubicación
 *   - detener compartir
 *   - listar usuarios activos
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserLocation.name, schema: UserLocationSchema },
    ]),
  ],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService], //  por si luego quieres usarlo en otros módulos
})
export class LocationsModule {}
