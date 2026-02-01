import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * ✅ Tipos de payload para señalización WebRTC
 * - El backend SOLO coordina (signaling). No transmite audio/video.
 */
type CallType = 'audio' | 'video';

type CallStartPayload = {
  callId: string; // ✅ id único por llamada (lo genera el cliente o backend)
  fromUserId: string;
  toUserId: string;
  callType: CallType;
  startedAt: string; // ISO date string
};

type CallAcceptPayload = {
  callId: string;
  fromUserId: string; // quien acepta
  toUserId: string;   // quien inició
  acceptedAt: string; // ISO
};

type CallRejectPayload = {
  callId: string;
  fromUserId: string; // quien rechaza
  toUserId: string;   // quien inició
  reason?: 'busy' | 'declined' | 'timeout';
  rejectedAt: string; // ISO
};

type CallEndPayload = {
  callId: string;
  fromUserId: string; // quien termina
  toUserId: string;   // el otro
  endedAt: string;    // ISO
};

type SdpPayload = {
  callId: string;
  toUserId: string;
  sdp: RTCSessionDescriptionInit;
};

type IcePayload = {
  callId: string;
  toUserId: string;
  candidate: RTCIceCandidateInit;
};

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket'], // ✅ reduce fallback/ruido en prod
})
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CallsGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * ✅ Autenticación y binding del socket al userId
   * - Requiere token JWT en handshake
   * - Socket se une a room = userId (para enviar eventos 1:1)
   */
  async handleConnection(client: Socket) {
    try {
      const token = this.extractBearerToken(client);

      if (!token) {
        this.logger.warn(`Socket sin token -> disconnect (${client.id})`);
        client.disconnect(true);
        return;
      }

      const payload = await this.verifyAccessToken(token);

      // ✅ Guardamos el userId en socket.data (safe place)
      client.data.userId = payload.sub;

      // ✅ Room por userId (permite server.to(userId).emit(...))
      client.join(payload.sub);

      this.logger.log(`Socket conectado userId=${payload.sub} socketId=${client.id}`);
    } catch (err) {
      this.logger.warn(`Socket auth inválida -> disconnect (${client.id})`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    this.logger.log(`Socket desconectado userId=${userId ?? 'unknown'} socketId=${client.id}`);
  }

  /**
   * ✅ Iniciar llamada
   * - Emite a receptor: call:incoming
   */
  @SubscribeMessage('call:start')
  handleCallStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallStartPayload,
  ) {
    // ✅ Seguridad mínima: el "fromUserId" debe coincidir con el socket autenticado
    this.assertCallerIdentity(client, payload.fromUserId);

    // ✅ Enviamos evento al receptor (room = toUserId)
    this.server.to(payload.toUserId).emit('call:incoming', payload);

    // (Opcional) feedback al que llama
    client.emit('call:calling', {
      callId: payload.callId,
      toUserId: payload.toUserId,
      callType: payload.callType,
    });
  }

  /**
   * ✅ Aceptar llamada
   * - Emite al que llamó: call:accepted
   */
  @SubscribeMessage('call:accept')
  handleCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallAcceptPayload,
  ) {
    this.assertCallerIdentity(client, payload.fromUserId);

    this.server.to(payload.toUserId).emit('call:accepted', payload);
    client.emit('call:accepted:ok', { callId: payload.callId });
  }

  /**
   * ✅ Rechazar llamada
   * - Emite al que llamó: call:rejected
   */
  @SubscribeMessage('call:reject')
  handleCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallRejectPayload,
  ) {
    this.assertCallerIdentity(client, payload.fromUserId);

    this.server.to(payload.toUserId).emit('call:rejected', payload);
    client.emit('call:rejected:ok', { callId: payload.callId });
  }

  /**
   * ✅ Terminar llamada
   * - Emite al otro participante: call:ended
   */
  @SubscribeMessage('call:end')
  handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CallEndPayload,
  ) {
    this.assertCallerIdentity(client, payload.fromUserId);

    this.server.to(payload.toUserId).emit('call:ended', payload);
    client.emit('call:ended:ok', { callId: payload.callId });
  }

  /**
   * ✅ SDP Offer/Answer (WebRTC)
   * - Se reenvía al otro peer
   */
  @SubscribeMessage('call:sdp')
  handleSdp(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SdpPayload,
  ) {
    this.assertAuthenticated(client);

    this.server.to(payload.toUserId).emit('call:sdp', payload);
  }

  /**
   * ✅ ICE candidates (WebRTC)
   * - Se reenvía al otro peer
   */
  @SubscribeMessage('call:ice')
  handleIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: IcePayload,
  ) {
    this.assertAuthenticated(client);

    this.server.to(payload.toUserId).emit('call:ice', payload);
  }

  // ---------------------------------------------------------------------------
  // ✅ Helpers privados (Clean Code)
  // ---------------------------------------------------------------------------

  /**
   * Extrae JWT desde:
   * - handshake.auth.token (recomendado)
   * - headers.authorization (compatibilidad)
   */
  private extractBearerToken(client: Socket): string | null {
    // ✅ Recomendado: socket.io-client -> io(url, { auth: { token: 'Bearer xxx' } })
    const authToken = client.handshake?.auth?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return this.normalizeBearer(authToken);
    }

    // ✅ Compatibilidad: Authorization header
    const header = client.handshake?.headers?.authorization;
    if (typeof header === 'string' && header.trim().length > 0) {
      return this.normalizeBearer(header);
    }

    return null;
  }

  /**
   * Normaliza token:
   * - Permite enviar "Bearer xxx" o directamente "xxx"
   */
  private normalizeBearer(value: string): string {
    const v = value.trim();
    return v.toLowerCase().startsWith('bearer ') ? v.slice(7).trim() : v;
  }

  /**
   * Verifica Access Token usando el mismo secreto del JwtStrategy
   */
  private async verifyAccessToken(token: string): Promise<{ sub: string; email?: string }> {
    const secret = this.config.get<string>('jwt.accessSecret');
    if (!secret) {
      // ✅ Falla rápido si configuración está mala
      throw new Error('Missing jwt.accessSecret in configuration');
    }
    return await this.jwt.verifyAsync(token, { secret });
  }

  /**
   * Asegura que el socket tenga userId autenticado
   */
  private assertAuthenticated(client: Socket) {
    if (!client.data?.userId) {
      throw new Error('Socket not authenticated');
    }
  }

  /**
   * Asegura que el usuario autenticado sea quien dice ser (anti-suplantación)
   */
  private assertCallerIdentity(client: Socket, fromUserId: string) {
    this.assertAuthenticated(client);

    const socketUserId = String(client.data.userId);
    if (socketUserId !== String(fromUserId)) {
      throw new Error('Forbidden: fromUserId does not match authenticated user');
    }
  }
}
