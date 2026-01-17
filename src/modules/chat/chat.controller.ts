import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

/**
 * ✅ Request autenticado
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

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * ✅ Extrae el userId del request de forma robusta
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
   * ✅ Traer historial completo
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

    return this.chatService.getMessages(userId, peerId, parsedLimit);
  }

  /**
   * ✅ Enviar mensaje
   * POST /chat/:peerId/messages
   * body: { "text": "hola" }
   */
  @Post(':peerId/messages')
  async sendMessage(
    @Req() req: AuthRequest,
    @Param('peerId') peerId: string,
    @Body() dto: SendMessageDto,
  ) {
    const userId = this.getUserIdFromReq(req);

    return this.chatService.sendMessage(userId, peerId, dto.text);
  }
}
