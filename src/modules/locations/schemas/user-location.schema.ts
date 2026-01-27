import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * ✅ UserLocation
 * Guarda la última ubicación reportada por un usuario.
 *
 * Importante (seguridad/privacidad):
 * - No se trackea si el usuario no comparte
 * - La ubicación live debe expirar automáticamente (liveUntil)
 */
@Schema({
  collection: 'user_locations',
  timestamps: true, // ✅ agrega createdAt y updatedAt automáticamente
})
export class UserLocation {
  /**
   * ✅ ID del usuario (MySQL - Prisma)
   * Lo mantenemos único para hacer UPSERT (1 ubicación por usuario)
   */
  @Prop({ required: true, unique: true, index: true })
  userId!: string;

  @Prop({ required: true })
  latitude!: number;

  @Prop({ required: true })
  longitude!: number;

  /**
   * ✅ Precisión del GPS (si el móvil lo entrega)
   */
  @Prop({ required: false })
  accuracy?: number;

  /**
   * ✅ Si el usuario está compartiendo live location
   */
  @Prop({ default: false })
  isLive!: boolean;

  /**
   * ✅ Expiración de live location
   * Si liveUntil < now => ya no se considera activo
   */
  @Prop({ required: false })
  liveUntil?: Date;
}

export type UserLocationDocument = UserLocation & Document;
export const UserLocationSchema = SchemaFactory.createForClass(UserLocation);
