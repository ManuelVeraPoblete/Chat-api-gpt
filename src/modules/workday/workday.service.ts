// src/modules/workday/workday.service.ts

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Workday, WorkdayDocument } from './schemas/workday.schema';
import { WorkdayDto } from './dto/workday.dto';
import { WorkdayEventType, WorkdayStatus } from './workday.types';

import { chileDateKey } from './utils/chile-datetime.util';

/**
 * ✅ WorkdayService
 * - Gestiona jornada laboral del usuario en MongoDB
 * - dateKey se calcula en timezone Chile (YYYY-MM-DD)
 *
 * Diseño (limpio y tolerante a errores):
 * - Estado actual (status) + Eventos (auditoría)
 * - Transiciones “normales” son estrictas
 * - Acciones de recuperación (RESET) son explícitas para casos de error humano
 *
 * Acciones disponibles:
 * - start():     NOT_STARTED -> ACTIVE ; ENDED -> ACTIVE (RECONNECT)
 * - pause():     ACTIVE -> PAUSED
 * - lunch():     ACTIVE -> LUNCH
 * - setActive(): PAUSED/LUNCH -> ACTIVE (RESUME) ; ENDED -> ACTIVE (RECONNECT)
 * - end():       ACTIVE/PAUSED/LUNCH -> ENDED (DISCONNECT)
 * - reset():     fuerza ACTIVE desde cualquier estado (con cierres defensivos)
 */
@Injectable()
export class WorkdayService {
  private readonly logger = new Logger(WorkdayService.name);

  constructor(
    @InjectModel(Workday.name)
    private readonly workdayModel: Model<WorkdayDocument>,
  ) {}

  // ---------------------------------------------------------------------------
  // ✅ Lectura de estado "hoy"
  // ---------------------------------------------------------------------------

  /**
   * ✅ Obtiene Workday de hoy para un usuario.
   * Si no existe, retorna NOT_STARTED sin persistir.
   */
  public async getTodayByUserId(userId: string): Promise<WorkdayDto> {
    if (!userId) throw new BadRequestException('userId requerido.');

    const dateKey = chileDateKey();
    const doc = await this.workdayModel.findOne({ userId, dateKey }).lean();

    if (!doc) {
      return this.toDto({
        userId,
        dateKey,
        status: WorkdayStatus.NOT_STARTED,
        events: [],
      } as unknown as Workday);
    }

    return this.toDto(doc as Workday);
  }

  /**
   * ✅ Estados de hoy en masa para lista de usuarios.
   * - Evita N+1
   * - NOT_STARTED para faltantes (sin persistir)
   */
  public async getTodayStatuses(userIds: string[]): Promise<Record<string, WorkdayDto>> {
    const normalized = Array.isArray(userIds)
      ? userIds.map((x) => String(x).trim()).filter(Boolean)
      : [];

    if (normalized.length === 0) return {};

    const dateKey = chileDateKey();

    const docs = await this.workdayModel
      .find({ dateKey, userId: { $in: normalized } })
      .lean();

    const map = new Map<string, WorkdayDto>();

    for (const d of docs ?? []) {
      map.set((d as any).userId, this.toDto(d as Workday));
    }

    for (const id of normalized) {
      if (!map.has(id)) {
        map.set(
          id,
          this.toDto({
            userId: id,
            dateKey,
            status: WorkdayStatus.NOT_STARTED,
            events: [],
          } as unknown as Workday),
        );
      }
    }

    return Object.fromEntries(map.entries());
  }

  // ---------------------------------------------------------------------------
  // ✅ Acciones de jornada
  // ---------------------------------------------------------------------------

  /**
   * ✅ Marca "Entrada" (o reconecta si estaba ENDED)
   *
   * Comportamiento tolerante:
   * - Si ya está ACTIVE/PAUSED/LUNCH -> idempotente (retorna estado actual)
   * - Si está ENDED -> reconecta (RECONNECT) y pasa a ACTIVE
   */
  public async start(userId: string): Promise<WorkdayDto> {
    const workday = await this.ensureTodayDoc(userId);

    // Idempotente si ya está en jornada (evita fricción en UI).
    if (
      workday.status === WorkdayStatus.ACTIVE ||
      workday.status === WorkdayStatus.PAUSED ||
      workday.status === WorkdayStatus.LUNCH
    ) {
      return this.toDto(workday.toObject() as Workday);
    }

    // Reconexión: ENDED -> ACTIVE
    if (workday.status === WorkdayStatus.ENDED) {
      workday.status = WorkdayStatus.ACTIVE;
      workday.events.push({ type: WorkdayEventType.RECONNECT, at: new Date() });
      const saved = await workday.save();
      return this.toDto(saved.toObject() as Workday);
    }

    // Inicio real: NOT_STARTED -> ACTIVE
    workday.status = WorkdayStatus.ACTIVE;
    workday.events.push({ type: WorkdayEventType.START, at: new Date() });

    const saved = await workday.save();
    return this.toDto(saved.toObject() as Workday);
  }

  /**
   * ✅ Marca PAUSED
   */
  public async pause(userId: string): Promise<WorkdayDto> {
    const workday = await this.ensureTodayDoc(userId);

    if (workday.status === WorkdayStatus.NOT_STARTED) {
      throw new BadRequestException('No puedes marcar pausa sin iniciar la jornada.');
    }
    if (workday.status === WorkdayStatus.ENDED) {
      throw new BadRequestException('Estás desconectado. Reconecta antes de pausar.');
    }

    // Idempotente
    if (workday.status === WorkdayStatus.PAUSED) {
      return this.toDto(workday.toObject() as Workday);
    }

    if (workday.status !== WorkdayStatus.ACTIVE) {
      throw new BadRequestException('Transición inválida a PAUSA.');
    }

    workday.status = WorkdayStatus.PAUSED;
    workday.events.push({ type: WorkdayEventType.PAUSE, at: new Date() });

    const saved = await workday.save();
    return this.toDto(saved.toObject() as Workday);
  }

  /**
   * ✅ Marca LUNCH
   */
  public async lunch(userId: string): Promise<WorkdayDto> {
    const workday = await this.ensureTodayDoc(userId);

    if (workday.status === WorkdayStatus.NOT_STARTED) {
      throw new BadRequestException('No puedes marcar almuerzo sin iniciar la jornada.');
    }
    if (workday.status === WorkdayStatus.ENDED) {
      throw new BadRequestException('Estás desconectado. Reconecta antes de almorzar.');
    }

    // Idempotente
    if (workday.status === WorkdayStatus.LUNCH) {
      return this.toDto(workday.toObject() as Workday);
    }

    if (workday.status !== WorkdayStatus.ACTIVE) {
      throw new BadRequestException('Transición inválida a ALMUERZO.');
    }

    workday.status = WorkdayStatus.LUNCH;
    workday.events.push({ type: WorkdayEventType.LUNCH, at: new Date() });

    const saved = await workday.save();
    return this.toDto(saved.toObject() as Workday);
  }

  /**
   * ✅ Pasa a ACTIVE desde:
   * - PAUSED / LUNCH  (RESUME)
   * - ENDED          (RECONNECT)
   */
  public async setActive(userId: string): Promise<WorkdayDto> {
    const workday = await this.ensureTodayDoc(userId);

    if (workday.status === WorkdayStatus.NOT_STARTED) {
      throw new BadRequestException('No puedes reanudar sin haber iniciado la jornada.');
    }

    // Idempotente
    if (workday.status === WorkdayStatus.ACTIVE) {
      return this.toDto(workday.toObject() as Workday);
    }

    if (workday.status === WorkdayStatus.ENDED) {
      workday.status = WorkdayStatus.ACTIVE;
      workday.events.push({ type: WorkdayEventType.RECONNECT, at: new Date() });
      const saved = await workday.save();
      return this.toDto(saved.toObject() as Workday);
    }

    if (workday.status !== WorkdayStatus.PAUSED && workday.status !== WorkdayStatus.LUNCH) {
      throw new BadRequestException('Transición inválida a ACTIVO.');
    }

    workday.status = WorkdayStatus.ACTIVE;
    workday.events.push({ type: WorkdayEventType.RESUME, at: new Date() });

    const saved = await workday.save();
    return this.toDto(saved.toObject() as Workday);
  }

  /**
   * ✅ Desconecta (fin de sesión dentro del día)
   *
   * Nota:
   * - Mantenemos nombre `end` por compatibilidad, pero semánticamente es "DISCONNECT".
   * - Puede reconectar más tarde con start() o setActive().
   */
  public async end(userId: string): Promise<WorkdayDto> {
    const workday = await this.ensureTodayDoc(userId);

    if (workday.status === WorkdayStatus.NOT_STARTED) {
      throw new BadRequestException('No puedes desconectar sin iniciar la jornada.');
    }

    // Idempotente
    if (workday.status === WorkdayStatus.ENDED) {
      return this.toDto(workday.toObject() as Workday);
    }

    workday.status = WorkdayStatus.ENDED;
    workday.events.push({ type: WorkdayEventType.END, at: new Date() });

    const saved = await workday.save();
    return this.toDto(saved.toObject() as Workday);
  }

  /**
   * ✅ Reset / Recuperación
   *
   * Cuando el usuario se “equivoca” (no siguió el flujo, o quedó en un estado que
   * no tiene sentido operativo), esta acción fuerza el estado a ACTIVE.
   *
   * Reglas:
   * - Si estaba NOT_STARTED => se registra START (para que el día tenga coherencia)
   * - Si estaba ENDED => se registra RECONNECT (vuelve a ACTIVE)
   * - Si estaba PAUSED/LUNCH => se registra RESET (cierra intervalos abiertos)
   * - Si estaba ACTIVE => idempotente (solo registra RESET si quieres auditoría)
   */
  public async reset(userId: string): Promise<WorkdayDto> {
    const workday = await this.ensureTodayDoc(userId);

    const now = new Date();

    if (workday.status === WorkdayStatus.NOT_STARTED) {
      workday.status = WorkdayStatus.ACTIVE;
      workday.events.push({ type: WorkdayEventType.START, at: now });
      const saved = await workday.save();
      return this.toDto(saved.toObject() as Workday);
    }

    if (workday.status === WorkdayStatus.ENDED) {
      workday.status = WorkdayStatus.ACTIVE;
      workday.events.push({ type: WorkdayEventType.RECONNECT, at: now });
      const saved = await workday.save();
      return this.toDto(saved.toObject() as Workday);
    }

    // Si ya está ACTIVE, lo dejamos idempotente y registramos RESET por trazabilidad.
    workday.status = WorkdayStatus.ACTIVE;
    workday.events.push({ type: WorkdayEventType.RESET, at: now });

    const saved = await workday.save();
    return this.toDto(saved.toObject() as Workday);
  }

  // ---------------------------------------------------------------------------
  // ✅ Helpers
  // ---------------------------------------------------------------------------

  /**
   * ✅ Asegura que exista doc del día
   */
  private async ensureTodayDoc(userId: string): Promise<WorkdayDocument> {
    if (!userId) throw new BadRequestException('userId requerido.');

    const dateKey = chileDateKey();

    const existing = await this.workdayModel.findOne({ userId, dateKey });
    if (existing) return existing;

    const created = new this.workdayModel({
      userId,
      dateKey,
      status: WorkdayStatus.NOT_STARTED,
      events: [],
    });

    return created.save();
  }

  /**
   * ✅ Entidad -> DTO (ALINEADO A WorkdayDto)
   * - events[].at: string ISO
   * - startedAt/endedAt/pauseStartedAt/lunchStartedAt: string | null
   * - totalPauseMinutes/totalLunchMinutes: number
   */
  private toDto(doc: Workday): WorkdayDto {
    // 1) Normaliza eventos a Date y ordena
    const events = (((doc as any).events ?? []) as Array<{ type: WorkdayEventType; at: any }>)
      .map((e) => ({
        type: e.type,
        at: e.at instanceof Date ? e.at : new Date(e.at),
      }))
      .sort((a, b) => a.at.getTime() - b.at.getTime());

    // 2) Campos requeridos por el DTO
    let startedAt: string | null = null;
    let endedAt: string | null = null;

    let pauseStartedAt: string | null = null;
    let lunchStartedAt: string | null = null;

    let totalPauseMinutes = 0;
    let totalLunchMinutes = 0;

    // 3) Acumuladores para intervalos
    let pauseOpenAt: Date | null = null;
    let lunchOpenAt: Date | null = null;

    // Para saber qué estábamos cerrando con RESUME/RESET
    let lastMode: 'PAUSE' | 'LUNCH' | null = null;

    const closePause = (to: Date) => {
      if (!pauseOpenAt) return;
      totalPauseMinutes += this.diffMinutes(pauseOpenAt, to);
      pauseOpenAt = null;
      lastMode = null;
    };

    const closeLunch = (to: Date) => {
      if (!lunchOpenAt) return;
      totalLunchMinutes += this.diffMinutes(lunchOpenAt, to);
      lunchOpenAt = null;
      lastMode = null;
    };

    for (const ev of events) {
      const iso = ev.at.toISOString();

      switch (ev.type) {
        case WorkdayEventType.START: {
          if (!startedAt) startedAt = iso;
          pauseOpenAt = null;
          lunchOpenAt = null;
          lastMode = null;
          break;
        }

        case WorkdayEventType.PAUSE: {
          pauseStartedAt = iso;
          pauseOpenAt = ev.at;
          // defensivo: si había almuerzo abierto, lo cerramos
          lunchOpenAt = null;
          lastMode = 'PAUSE';
          break;
        }

        case WorkdayEventType.LUNCH: {
          lunchStartedAt = iso;
          lunchOpenAt = ev.at;
          // defensivo: si había pausa abierta, la cerramos
          pauseOpenAt = null;
          lastMode = 'LUNCH';
          break;
        }

        case WorkdayEventType.RESUME: {
          // RESUME cierra el último modo abierto (PAUSE o LUNCH)
          if (lastMode === 'PAUSE') closePause(ev.at);
          if (lastMode === 'LUNCH') closeLunch(ev.at);
          break;
        }

        case WorkdayEventType.RESET: {
          // RESET cierra cualquier intervalo abierto y deja el estado "limpio"
          closePause(ev.at);
          closeLunch(ev.at);
          // Si el usuario resetea sin START previo por inconsistencias, forzamos startedAt
          if (!startedAt) startedAt = iso;
          break;
        }

        case WorkdayEventType.RECONNECT: {
          // Reconexión no afecta totales; si no había START, lo iniciamos igual.
          if (!startedAt) startedAt = iso;
          break;
        }

        case WorkdayEventType.END: {
          endedAt = iso;

          // Si por algún motivo quedó un intervalo abierto, lo cerramos al END
          closePause(ev.at);
          closeLunch(ev.at);

          break;
        }

        default:
          break;
      }
    }

    // 4) DTO events (at string ISO)
    const eventsDto = events.map((e) => ({
      type: e.type,
      at: e.at.toISOString(),
    }));

    return {
      userId: (doc as any).userId,
      dateKey: (doc as any).dateKey,
      status: (doc as any).status,

      startedAt,
      endedAt,

      pauseStartedAt,
      lunchStartedAt,

      totalPauseMinutes,
      totalLunchMinutes,

      events: eventsDto,
    };
  }

  /**
   * ✅ Diferencia en minutos, redondeo hacia abajo (comportamiento estable).
   */
  private diffMinutes(from: Date, to: Date): number {
    const ms = to.getTime() - from.getTime();
    if (ms <= 0) return 0;
    return Math.floor(ms / 60000);
  }
}
