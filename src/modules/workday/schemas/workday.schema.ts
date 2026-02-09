// src/modules/workday/schemas/workday.schema.ts

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WorkdayEvent, WorkdayStatus } from '../workday.types';

export type WorkdayDocument = Workday & Document;

/**
 *  Workday (Jornada)
 *
 * Diseño:
 * - Un documento por usuario por día (userId + dateKey)
 * - status indica el estado actual
 * - startedAt/endedAt guardan inicio/fin de jornada
 * - pauseStartedAt/lunchStartedAt indican intervalos abiertos
 * - totalPauseMinutes/totalLunchMinutes acumuladores (cierres automáticos)
 * - events registra auditoría (qué acción ocurrió y cuándo)
 */
@Schema({ timestamps: true })
export class Workday {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  /**
   * dateKey en formato YYYY-MM-DD (zona Chile)
   * Permite consultas por día de manera estable.
   */
  @Prop({ type: String, required: true, index: true })
  dateKey!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(WorkdayStatus),
    default: WorkdayStatus.NOT_STARTED,
    index: true,
  })
  status!: WorkdayStatus;

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  @Prop({ type: Date, default: null })
  endedAt!: Date | null;

  //  Intervalos abiertos (se cierran al cambiar de estado o finalizar jornada)
  @Prop({ type: Date, default: null })
  pauseStartedAt!: Date | null;

  @Prop({ type: Date, default: null })
  lunchStartedAt!: Date | null;

  //  Acumuladores en minutos (simple y suficiente para reporting)
  @Prop({ type: Number, default: 0 })
  totalPauseMinutes!: number;

  @Prop({ type: Number, default: 0 })
  totalLunchMinutes!: number;

  @Prop({
    type: [
      {
        type: { type: String, required: true },
        at: { type: Date, required: true },
      },
    ],
    default: [],
  })
  events!: WorkdayEvent[];
}

export const WorkdaySchema = SchemaFactory.createForClass(Workday);

//  Unicidad: 1 jornada por usuario por día
WorkdaySchema.index({ userId: 1, dateKey: 1 }, { unique: true });
