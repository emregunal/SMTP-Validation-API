import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export const API_KEY_HEADER = 'x-api-key';

/**
 * Simple static API-key auth. Compares the `x-api-key` request header against
 * the configured `API_KEY`. Missing or wrong key -> 401.
 *
 * Applied per-controller (see ValidationController); /health and /docs stay
 * public.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.header(API_KEY_HEADER);
    const expectedKey = this.configService.get<string>('app.apiKey');

    if (!expectedKey) {
      // Fail closed: if no key is configured, refuse rather than allow all.
      throw new UnauthorizedException(
        'API key is not configured on the server',
      );
    }

    if (!providedKey || providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
