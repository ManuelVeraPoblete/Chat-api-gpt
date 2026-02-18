// src/modules/admin/logs/admin-logs.service.ts
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { AdminLogsQueryDto, AdminLogLevel } from './dto/admin-logs-query.dto';
import { AdminLogsResponseDto, AdminLogEntryDto } from './dto/admin-logs-response.dto';

/**
 * AdminLogsService
 * - SRP: leer + parsear + filtrar + paginar logs
 * - Robusto: soporta logs JSON (pino) y formato texto clásico
 * - Eficiente: lee sólo las últimas N líneas (tail)
 */
@Injectable()
export class AdminLogsService {
  /**
   * Tu backend YA escribe en:
   * - process.env.LOG_DIR || <root>/logs
   * y el archivo se llama app.log
   */
  private resolveLogFilePath(): string {
    const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    return path.join(logDir, 'app.log');
  }

  /**
   * Tail eficiente (ring buffer) para no cargar archivos grandes completos.
   */
  private async readTailLines(filePath: string, tail: number): Promise<string[]> {
    if (!fs.existsSync(filePath)) return [];

    const input = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input, crlfDelay: Infinity });

    const buffer = new Array<string>(tail);
    let count = 0;

    for await (const line of rl) {
      buffer[count % tail] = line;
      count++;
    }

    const size = Math.min(count, tail);
    const start = count >= tail ? count % tail : 0;

    const result: string[] = [];
    for (let i = 0; i < size; i++) {
      result.push(buffer[(start + i) % tail]);
    }

    return result;
  }

  private toDate(value?: string): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private mapPinoLevel(level: number): AdminLogLevel | 'DEBUG' | 'UNKNOWN' {
    // Pino: 10 trace, 20 debug, 30 info, 40 warn, 50 error, 60 fatal
    if (level >= 60) return 'ERROR';
    if (level >= 50) return 'ERROR';
    if (level >= 40) return 'WARN';
    if (level >= 30) return 'INFO';
    if (level >= 20) return 'DEBUG';
    return 'UNKNOWN';
  }

  /**
   * Parser tolerante:
   * 1) JSON line (pino)
   * 2) "YYYY-MM-DD HH:mm:ss.SSS LEVEL mensaje"
   * 3) fallback raw
   */
  private parseLine(raw: string): { timestamp: string; level: string; message: string } {
    const line = (raw ?? '').trim();
    if (!line) return { timestamp: '', level: 'UNKNOWN', message: '' };

    // 1) JSON (pino)
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        const obj = JSON.parse(line);
        const ts = obj.time ?? obj.timestamp ?? obj.ts ?? obj.date;
        const lvl = obj.level;
        const msg = obj.msg ?? obj.message ?? obj.err?.message ?? line;

        const timestamp = typeof ts === 'string' ? ts : '';
        const level =
          typeof lvl === 'number'
            ? this.mapPinoLevel(lvl)
            : typeof lvl === 'string'
              ? lvl.toUpperCase()
              : 'UNKNOWN';

        return { timestamp, level, message: String(msg ?? '') };
      } catch {
        // si falla JSON, cae al parser texto
      }
    }

    // 2) ISO con espacio: 2026-02-17T10:15:22.123Z INFO msg
    const isoMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[^ ]+)\s+(INFO|WARN|ERROR|DEBUG)\s+(.*)$/);
    if (isoMatch) return { timestamp: isoMatch[1], level: isoMatch[2], message: isoMatch[3] };

    // 3) Standard: 2026-02-17 10:15:22.123 INFO msg
    const stdMatch = line.match(
      /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s+(INFO|WARN|ERROR|DEBUG)\s+(.*)$/
    );
    if (stdMatch) return { timestamp: stdMatch[1], level: stdMatch[2], message: stdMatch[3] };

    return { timestamp: '', level: 'UNKNOWN', message: line };
  }

  async getLogs(query: AdminLogsQueryDto): Promise<AdminLogsResponseDto> {
    const filePath = this.resolveLogFilePath();
    const lines = await this.readTailLines(filePath, query.tail);

    const fromDate = this.toDate(query.from);
    const toDate = this.toDate(query.to);
    const qLower = (query.q ?? '').trim().toLowerCase();

    // Parse + filter
    const parsed: Omit<AdminLogEntryDto, 'index'>[] = [];
    for (const raw of lines) {
      if (!raw?.trim()) continue;

      const p = this.parseLine(raw);
      const level = (p.level || 'UNKNOWN').toUpperCase();

      // level filter
      if (query.level && level !== query.level) continue;

      // text filter
      if (qLower) {
        const hay = `${p.message} ${raw}`.toLowerCase();
        if (!hay.includes(qLower)) continue;
      }

      // date filter (si parseable)
      const dt = this.toDate(p.timestamp);
      if (fromDate && dt && dt < fromDate) continue;
      if (toDate && dt && dt > toDate) continue;

      parsed.push({
        timestamp: p.timestamp || '',
        level: (['INFO', 'WARN', 'ERROR', 'DEBUG'].includes(level) ? level : 'UNKNOWN') as any,
        message: p.message ?? '',
        raw,
      });
    }

    // Orden: el archivo va del más antiguo al más nuevo.
    // UI tipo “logs”: mostramos lo más reciente primero.
    parsed.reverse();

    const total = parsed.length;
    const size = query.size;
    const page = query.page;

    const start = (page - 1) * size;
    const end = start + size;

    const items: AdminLogEntryDto[] = parsed.slice(start, end).map((it, idx) => ({
      index: start + idx + 1,
      ...it,
    }));

    return {
      page,
      size,
      total,
      level: query.level,
      from: query.from,
      to: query.to,
      q: query.q,
      lastEventAt: parsed[0]?.timestamp || undefined,
      source: filePath, // si no quieres exponer ruta, elimina esta línea aquí y del DTO
      items,
    };
  }
}
