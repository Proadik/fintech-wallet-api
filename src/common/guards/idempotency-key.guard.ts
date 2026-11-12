import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';

@Injectable()
export class IdempotencyKeyGuard implements CanActivate {
  canActivate (context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>()
    const key = request.headers['idempotency-key']

    if (!key) {
      throw new BadRequestException('Idempotency-Key header is required')
    }

    if (!isUUID(key)) {
      throw new BadRequestException('Idempotency-Key header must be a UUID')
    }

    return true
  }
}
