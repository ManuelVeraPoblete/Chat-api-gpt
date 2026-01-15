import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';

/**
 * Strategy custom: validamos refresh token enviado en body.
 * Evita cookies si no las usarás.
 */
@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh') {
  async validate(req: any) {
    const token = req?.body?.refreshToken;
    if (!token) throw new UnauthorizedException('Missing refreshToken');
    return { refreshToken: token };
  }
}
