// src/modules/locations/locations.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { UpdateLocationDto } from './dto/update-location.dto';
import { UserLocation, UserLocationDocument } from './schemas/user-location.schema';

/**
 *  LocationsService
 *
 * Responsabilidad única (SRP):
 * - Gestionar persistencia y reglas de negocio de ubicaciones.
 *
 * Notas:
 * - Upsert: 1 documento por usuario
 * - "Activo" = updatedAt reciente o liveUntil vigente
 */
@Injectable()
export class LocationsService {
  constructor(
    @InjectModel(UserLocation.name)
    private readonly locationModel: Model<UserLocationDocument>,
  ) {}

  /**
   *  Actualiza (upsert) la ubicación del usuario autenticado.
   * Soporta:
   * - ubicación puntual (isLive=false)
   * - live location (isLive=true + liveMinutes)
   *
   * ⚠️ Importante (MongoDB):
   * - NO se debe incluir `userId` en $set si `userId` ya va en el filtro del updateOne
   * - Para upsert, userId debe ir en $setOnInsert
   */
  async upsertMyLocation(userId: string, dto: UpdateLocationDto) {
    const isLive = dto.isLive === true;

    //  Si pide live y no manda minutos, usamos un default razonable (15 min)
    const liveMinutes = isLive ? dto.liveMinutes ?? 15 : undefined;

    const now = new Date();
    const liveUntil = isLive ? new Date(now.getTime() + liveMinutes! * 60_000) : undefined;

    /**
     *  Update seguro (sin userId en $set)
     * - userId SOLO en filtro y $setOnInsert
     */
    const updateSet: Partial<UserLocation> = {
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy,
      isLive,
      liveUntil,
    };

    await this.locationModel.updateOne(
      { userId }, //  filtro por userId
      {
        //  Actualiza campos variables
        $set: updateSet,

        //  Solo si crea el documento por primera vez
        $setOnInsert: { userId },
      },
      { upsert: true },
    );

    //  Retornamos el estado actualizado
    return this.locationModel.findOne({ userId }).lean().exec();
  }

  /**
   *  Detener compartir ubicación
   * - Marca isLive=false y borra liveUntil
   */
  async stopSharing(userId: string) {
    await this.locationModel.updateOne(
      { userId },
      {
        $set: { isLive: false },
        $unset: { liveUntil: 1 },
      },
    );

    return { ok: true };
  }

  /**
   *  Lista ubicaciones activas
   *
   * Definición "activo/conectado":
   * - updatedAt >= now - maxAgeSeconds  (ej: 120s)
   *   OR
   * - isLive=true AND liveUntil > now
   *
   * Esto permite:
   * - ubicación puntual reciente (usuarios conectados)
   * - live location aún vigente
   */
  async getActiveLocations(maxAgeSeconds: number = 120) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - maxAgeSeconds * 1000);

    const docs = await this.locationModel
      .find({
        $or: [
          { updatedAt: { $gte: cutoff } },
          { isLive: true, liveUntil: { $gt: now } },
        ],
      })
      .lean()
      .exec();

    //  Retorno limpio (DTO-like)
    return docs.map((d: any) => ({
      userId: d.userId,
      latitude: d.latitude,
      longitude: d.longitude,
      accuracy: d.accuracy ?? null,
      isLive: Boolean(d.isLive),
      liveUntil: d.liveUntil ?? null,
      updatedAt: d.updatedAt ?? null,
    }));
  }
}
