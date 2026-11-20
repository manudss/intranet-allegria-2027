import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
@Injectable()
export class PrivateResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const res = context.switchToHttp().getResponse();
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return next.handle();
  }
}
