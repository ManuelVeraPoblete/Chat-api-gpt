import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Express } from 'express'; //  IMPORTANTE: Express para Multer types

import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

import { ChatService } from './chat.service';

/**
 *  Request autenticado
 * Passport deja el payload en req.user,
 * pero el shape puede variar según tu JwtStrategy.
 */
type AuthRequest = Request & {
  user?: {
    sub?: string;
    id?: string;
    userId?: string;
    email?: string;
  };
};

/**
 *  Ubicación entrante (Front -> API)
 */
type LocationInput = {
  latitude: number;
  longitude: number;
  label?: string;
};

/**
 *  Body para unread-counts
 */
type UnreadCountsBody = {
  peerIds: string[];
};

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   *  Extrae el userId del request de forma robusta
   * (sub / id / userId)
   */
  private getUserIdFromReq(req: AuthRequest): string {
    const userId = req.user?.sub ?? req.user?.id ?? req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException(
        'JWT válido pero sin identificador de usuario (req.user.sub | req.user.id | req.user.userId)',
      );
    }

    return userId;
  }

  /**
   *  Parsea location que puede llegar de 2 maneras:
   * - JSON normal: { location: { latitude, longitude } }
   * - multipart/form-data: location viene como string JSON
   */
  private parseLocation(value: unknown): LocationInput | undefined {
    if (!value) return undefined;

    //  multipart: location = '{"latitude":..,"longitude":..}'
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return this.ensureValidLocation(parsed);
      } catch {
        throw new BadRequestException('El campo location viene inválido (JSON no parseable)');
      }
    }

    //  JSON: location = object
    if (typeof value === 'object') {
      return this.ensureValidLocation(value as any);
    }

    throw new BadRequestException('El campo location tiene un formato inválido');
  }

  /**
   *  Validación de negocio (mínima)
   * La validación completa y reglas finales las refuerza ChatService.
   */
  private ensureValidLocation(loc: any): LocationInput {
    const latitude = Number(loc?.latitude);
    const longitude = Number(loc?.longitude);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new BadRequestException('Latitud inválida');
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new BadRequestException('Longitud inválida');
    }

    return {
      latitude,
      longitude,
      label: typeof loc?.label === 'string' ? loc.label : undefined,
    };
  }

  /**
   *  NUEVO: Conteo de no-leídos por peer (Home)
   * POST /chat/unread-counts
   *
   * Body:
   * { "peerIds": ["uuid-1","uuid-2"] }
   *
   *  IMPORTANTE:
   * - Debe ir ANTES de rutas con :peerId para evitar ambigüedades.
   */
  @Post('unread-counts')
  async getUnreadCounts(@Req() req: AuthRequest, @Body() body: UnreadCountsBody) {
    const userId = this.getUserIdFromReq(req);

    const peerIds = Array.isArray(body?.peerIds) ? body.peerIds.map(String) : [];

    return {
      counts: await this.chatService.getUnreadCounts(userId, peerIds),
    };
  }

  /**
   *  Traer historial completo
   * GET /chat/:peerId/messages?limit=200
   */
  @Get(':peerId/messages')
  async getMessages(
    @Req() req: AuthRequest,
    @Param('peerId') peerId: string,
    @Query('limit') limit?: string,
  ) {
    const userId = this.getUserIdFromReq(req);

    const parsedLimit = limit ? Number(limit) : 200;
    const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : 200;

    return this.chatService.getMessages(userId, peerId, safeLimit);
  }

  /**
   *  Enviar mensaje WhatsApp PRO
   *
   * POST /chat/:peerId/messages
   *
   * Soporta:
   *  JSON:
   *   { "text": "hola", "location": { "latitude":.., "longitude":.. } }
   *
   *  multipart/form-data:
   *   text: "hola"
   *   location: '{"latitude":..,"longitude":..}'
   *   files: <file>[]   (hasta 10)
   */
  @Post(':peerId/messages')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          //  Guardamos en /uploads/chat
          const uploadPath = join(process.cwd(), 'uploads', 'chat');

          //  Asegura carpeta existente (Clean Code)
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }

          cb(null, uploadPath);
        },
        filename: (_req, file, cb) => {
          //  Nombre único + extensión original
          const safeExt = extname(file.originalname || '').toLowerCase();
          const name = `${Date.now()}-${randomUUID()}${safeExt}`;
          cb(null, name);
        },
      }),

      //  Límite hard para no matar memoria
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB por archivo (WhatsApp-like)
        files: 10,
      },
    }),
  )
  async sendMessage(
    @Req() req: AuthRequest,
    @Param('peerId') peerId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any,
  ) {
    const userId = this.getUserIdFromReq(req);

    const text = typeof body?.text === 'string' ? body.text : '';
    const location = this.parseLocation(body?.location);

    //  Delegamos regla final al service (SOLID)
    return this.chatService.sendMessage(userId, peerId, {
      text,
      files: files ?? [],
      location,
    });
  }
}
