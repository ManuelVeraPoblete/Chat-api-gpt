// src/modules/workday/dto/workday.dto.ts

import { WorkdayEvent, WorkdayStatus } from '../workday.types';

/**
 *  DTO de salida (API)
 * Evita exponer internals de Mongoose / Document.
 */
export type WorkdayDto = {
  userId: string;
  dateKey: string;
  status: WorkdayStatus;

  startedAt: string | null;
  endedAt: string | null;

  pauseStartedAt: string | null;
  lunchStartedAt: string | null;

  totalPauseMinutes: number;
  totalLunchMinutes: number;

  events: Array<{ type: WorkdayEvent['type']; at: string }>;
};
