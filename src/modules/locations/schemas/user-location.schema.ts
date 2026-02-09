// src/modules/locations/schemas/user-location.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 *  UserLocationDocument
 * Documento Mongo tipado para Mongoose.
 * - Incluye campos del schema + Document + timestamps (createdAt/updatedAt).
 */
export type UserLocationDocument = UserLocation & Document;

/**
 *  UserLocation Schema (Mongo)
 *
 * Reglas:
 * - 1 documento por usuario => userId único.
 * - updatedAt se usa para definir "activo" (cutoff por segundos).
 *
 * timestamps:
 * - createdAt y updatedAt se gestionan automáticamente por Mongoose.
 */
@Schema({
  timestamps: true,
  collection: 'user_locations', //  nombre explícito (opcional, pero recomendado)
})
export class UserLocation {
  /**
   *  Identificador del usuario (1 doc por usuario)
   * - unique + index para upsert eficiente
   */
  @Prop({
    required: true,
    unique: true,
    index: true,
    type: String,
  })
  userId!: string;

  /**
   *  Coordenadas
   */
  @Prop({ required: true, type: Number })
  latitude!: number;

  @Prop({ required: true, type: Number })
  longitude!: number;

  /**
   *  Precisión (metros, si el device la entrega)
   */
  @Prop({ required: false, type: Number })
  accuracy?: number;

  /**
   *  Live location:
   * - isLive=true indica que el usuario está compartiendo ubicación en vivo
   * - liveUntil define vigencia
   */
  @Prop({ required: true, default: false, type: Boolean })
  isLive!: boolean;

  @Prop({ required: false, type: Date })
  liveUntil?: Date;

  /**
   * ⚠️ createdAt y updatedAt se generan por timestamps:true
   * No se declaran aquí, pero existen en el documento.
   */
}

export const UserLocationSchema = SchemaFactory.createForClass(UserLocation);

/**
 *  Índices adicionales (opcionales pero útiles)
 * - liveUntil para queries de activos en vivo
 */
UserLocationSchema.index({ liveUntil: 1 });
