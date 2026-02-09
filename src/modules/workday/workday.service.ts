// src/modules/workday/workday.service.ts

import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Workday, WorkdayDocument } from './schemas/workday.schema';
import { WorkdayDto } from './dto/workday.dto';
import { WorkdayEventType, WorkdayStatus } from './workday.types';
import { chileDateKey, nowChile } from './utils/chile-datetime.util';

/**
 * ✅ WorkdayService
 *
 * Reglas del producto (según tu último requerimiento):
 * - Si está ENDED:
 *    - Puede marcar INICIAR (start) para volver a ACTIVE
 *    - Puede marcar RECONEXIÓN (active) para volver a ACTIVE
 * - Si está PAUSED:
 *    - Puede marcar REINICIAR (active) para volver a ACTIVE
 * - Si está LUNCH:
 *    - Puede marcar TERMINAR COLACIÓN (active) para volver a ACTIVE
 * - No se permiten acciones repetidas (ej: PAUSE estando PAUSED)
 * - Al cambiar de estado se cierran intervalos abiertos (pausa/colación)
 */
@Injectable()
export class WorkdayService {
  private readonly logger = new Logger(WorkdayService.name);

  constructor(
    @InjectModel(Workday.name)
    private readonly workdayModel: Model<WorkdayDocument>,
  ) {}

  /**
   * ✅ GET estado de hoy (si no existe: NOT_STARTED sin persistir)
   */
  async getToday(userId: string): Promise<WorkdayDto> {
    const dateKey = chileDateKey();
    const doc = await this.workdayModel.findOne({ userId, dateKey }).lean();

    if (!doc) {
      return this.toDto({
        userId,
        dateKey,
        status: WorkdayStatus.NOT_STARTED,
        startedAt: null,
        endedAt: null,
        pauseStartedAt: null,
        lunchStartedAt: null,
        totalPauseMinutes: 0,
        totalLunchMinutes: 0,
        events: [],
      } as any);
    }

    return this.toDto(doc);
  }

  /**
   * ✅ START: marca "entrada" o "iniciar" (si estaba ENDED)
   *
   * Reglas:
   * - Si NO existe documento: crea y queda ACTIVE
   * - Si existe y está NOT_STARTED: deja ACTIVE (y registra START)
   * - Si existe y está ENDED: permite "iniciar nuevamente" (queda ACTIVE, endedAt=null, registra START)
   * - En ACTIVE/PAUSED/LUNCH: idempotente (no duplica evento)
   */
  async start(userId: string): Promise<WorkdayDto> {
    const dateKey = chileDateKey();
    const now = nowChile();

    const existing = await this.workdayModel.findOne({ userId, dateKey });

    if (!existing) {
      const created = await this.workdayModel.create({
        userId,
        dateKey,
        status: WorkdayStatus.ACTIVE,
        startedAt: now,
        endedAt: null,
        pauseStartedAt: null,
        lunchStartedAt: null,
        totalPauseMinutes: 0,
        totalLunchMinutes: 0,
        events: [{ type: WorkdayEventType.START, at: now }],
      });

      this.logger.log(`[WORKDAY] START user=${userId} dateKey=${dateKey}`);
      return this.toDto(created.toObject());
    }

    // ✅ Si estaba ENDED, ahora se permite "iniciar nuevamente"
    if (existing.status === WorkdayStatus.ENDED) {
      // Cierra intervalos por seguridad (normalmente ya están cerrados)
      this.closeOpenIntervals(existing, now);

      existing.status = WorkdayStatus.ACTIVE;
      existing.endedAt = null; // ✅ vuelve a "conectado"
      existing.pauseStartedAt = null;
      existing.lunchStartedAt = null;

      // Nota: NO tocamos startedAt para mantener trazabilidad de primera entrada del día
      existing.startedAt = existing.startedAt ?? now;

      existing.events.push({ type: WorkdayEventType.START, at: now });
      await existing.save();

      this.logger.log(`[WORKDAY] START (restart after ENDED) user=${userId} dateKey=${dateKey}`);
      return this.toDto(existing.toObject());
    }

    // Si por algún caso raro quedó NOT_STARTED, la activamos
    if (existing.status === WorkdayStatus.NOT_STARTED) {
      existing.status = WorkdayStatus.ACTIVE;
      existing.startedAt = existing.startedAt ?? now;
      existing.events.push({ type: WorkdayEventType.START, at: now });
      await existing.save();

      this.logger.log(`[WORKDAY] START (recover) user=${userId} dateKey=${dateKey}`);
      return this.toDto(existing.toObject());
    }

    // ✅ idempotente
    this.logger.log(`[WORKDAY] START (idempotent) user=${userId} dateKey=${dateKey} status=${existing.status}`);
    return this.toDto(existing.toObject());
  }

  /**
   * ✅ ACTIVE: reanuda trabajo (vuelve a ACTIVE)
   *
   * Reglas:
   * - PAUSED -> ACTIVE (reiniciar)
   * - LUNCH  -> ACTIVE (terminar colación)
   * - ENDED  -> ACTIVE (reconexión)
   * - ACTIVE -> ACTIVE (idempotente)
   */
  async setActive(userId: string): Promise<WorkdayDto> {
    const doc = await this.requireToday(userId);
    this.assertStarted(doc);

    const now = nowChile();

    // ✅ Si ya está ACTIVE, idempotente
    if (doc.status === WorkdayStatus.ACTIVE) {
      this.logger.log(`[WORKDAY] ACTIVE (idempotent) user=${userId} dateKey=${doc.dateKey}`);
      return this.toDto(doc.toObject());
    }

    // ✅ Permitimos reanudar desde PAUSED, LUNCH o ENDED
    if (
      doc.status !== WorkdayStatus.PAUSED &&
      doc.status !== WorkdayStatus.LUNCH &&
      doc.status !== WorkdayStatus.ENDED
    ) {
      throw new BadRequestException(`Transición inválida: ${doc.status} -> ACTIVE`);
    }

    const fromStatus = doc.status;

    // ✅ Cierra intervalos abiertos (si venías de pausa/colación)
    this.closeOpenIntervals(doc, now);

    // ✅ Reconexión: si estaba ENDED, reabrimos "conectado"
    doc.status = WorkdayStatus.ACTIVE;
    doc.endedAt = null;
    doc.pauseStartedAt = null;
    doc.lunchStartedAt = null;

    doc.events.push({ type: WorkdayEventType.RESUME, at: now });

    await doc.save();

    this.logger.log(`[WORKDAY] ACTIVE user=${userId} dateKey=${doc.dateKey} from=${fromStatus}`);
    return this.toDto(doc.toObject());
  }

  /**
   * ✅ PAUSE: inicia pausa
   * - ACTIVE -> PAUSED
   * - LUNCH  -> PAUSED (cierra colación y abre pausa)
   */
  async pause(userId: string): Promise<WorkdayDto> {
    const doc = await this.requireToday(userId);
    this.assertStarted(doc);

    const now = nowChile();

    if (doc.status === WorkdayStatus.PAUSED) {
      throw new BadRequestException('Ya estás en pausa.');
    }

    if (doc.status !== WorkdayStatus.ACTIVE && doc.status !== WorkdayStatus.LUNCH) {
      throw new BadRequestException(`Transición inválida: ${doc.status} -> PAUSED`);
    }

    this.closeOpenIntervals(doc, now);

    doc.status = WorkdayStatus.PAUSED;
    doc.pauseStartedAt = now;
    doc.lunchStartedAt = null;
    doc.events.push({ type: WorkdayEventType.PAUSE, at: now });

    await doc.save();

    this.logger.log(`[WORKDAY] PAUSE user=${userId} dateKey=${doc.dateKey}`);
    return this.toDto(doc.toObject());
  }

  /**
   * ✅ LUNCH: inicia colación
   * - ACTIVE -> LUNCH
   * - PAUSED -> LUNCH (cierra pausa y abre colación)
   */
  async lunch(userId: string): Promise<WorkdayDto> {
    const doc = await this.requireToday(userId);
    this.assertStarted(doc);

    const now = nowChile();

    if (doc.status === WorkdayStatus.LUNCH) {
      throw new BadRequestException('Ya estás en colación.');
    }

    if (doc.status !== WorkdayStatus.ACTIVE && doc.status !== WorkdayStatus.PAUSED) {
      throw new BadRequestException(`Transición inválida: ${doc.status} -> LUNCH`);
    }

    this.closeOpenIntervals(doc, now);

    doc.status = WorkdayStatus.LUNCH;
    doc.lunchStartedAt = now;
    doc.pauseStartedAt = null;
    doc.events.push({ type: WorkdayEventType.LUNCH, at: now });

    await doc.save();

    this.logger.log(`[WORKDAY] LUNCH user=${userId} dateKey=${doc.dateKey}`);
    return this.toDto(doc.toObject());
  }

  /**
   * ✅ END: "desconexión"
   *
   * - Luego puede "Reconexión" => POST /workday/active
   * - O puede "Iniciar" => POST /workday/start
   */
  async end(userId: string): Promise<WorkdayDto> {
    const doc = await this.requireToday(userId);
    this.assertStarted(doc);

    const now = nowChile();

    if (doc.status === WorkdayStatus.ENDED) {
      this.logger.log(`[WORKDAY] END (idempotent) user=${userId} dateKey=${doc.dateKey}`);
      return this.toDto(doc.toObject());
    }

    if (doc.status === WorkdayStatus.NOT_STARTED) {
      throw new BadRequestException('Debes marcar entrada antes de desconectarte.');
    }

    this.closeOpenIntervals(doc, now);

    doc.status = WorkdayStatus.ENDED;
    doc.endedAt = now;
    doc.pauseStartedAt = null;
    doc.lunchStartedAt = null;
    doc.events.push({ type: WorkdayEventType.END, at: now });

    await doc.save();

    this.logger.log(`[WORKDAY] END user=${userId} dateKey=${doc.dateKey}`);
    return this.toDto(doc.toObject());
  }

  // -----------------------
  // Helpers
  // -----------------------

  private async requireToday(userId: string): Promise<WorkdayDocument> {
    const dateKey = chileDateKey();
    const doc = await this.workdayModel.findOne({ userId, dateKey });

    if (!doc) {
      throw new NotFoundException('No existe jornada para hoy. Debes marcar entrada primero.');
    }

    return doc;
  }

  private assertStarted(doc: WorkdayDocument): void {
    if (!doc.startedAt || doc.status === WorkdayStatus.NOT_STARTED) {
      throw new BadRequestException('Debes marcar entrada antes de registrar acciones.');
    }
  }

  private closeOpenIntervals(doc: WorkdayDocument, now: Date): void {
    if (doc.pauseStartedAt) {
      const minutes = this.diffMinutes(doc.pauseStartedAt, now);
      doc.totalPauseMinutes += minutes;
      doc.pauseStartedAt = null;
    }

    if (doc.lunchStartedAt) {
      const minutes = this.diffMinutes(doc.lunchStartedAt, now);
      doc.totalLunchMinutes += minutes;
      doc.lunchStartedAt = null;
    }
  }

  private diffMinutes(from: Date, to: Date): number {
    const ms = to.getTime() - from.getTime();
    return Math.max(0, Math.ceil(ms / 60000));
  }

  private toDto(doc: any): WorkdayDto {
    return {
      userId: doc.userId,
      dateKey: doc.dateKey,
      status: doc.status,

      startedAt: doc.startedAt ? new Date(doc.startedAt).toISOString() : null,
      endedAt: doc.endedAt ? new Date(doc.endedAt).toISOString() : null,

      pauseStartedAt: doc.pauseStartedAt ? new Date(doc.pauseStartedAt).toISOString() : null,
      lunchStartedAt: doc.lunchStartedAt ? new Date(doc.lunchStartedAt).toISOString() : null,

      totalPauseMinutes: doc.totalPauseMinutes ?? 0,
      totalLunchMinutes: doc.totalLunchMinutes ?? 0,

      events: Array.isArray(doc.events)
        ? doc.events.map((e: any) => ({
            type: e.type,
            at: new Date(e.at).toISOString(),
          }))
        : [],
    };
  }
}
