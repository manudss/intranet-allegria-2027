import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthTokenGuard } from './auth-token.guard';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Default-deny guard registered globally (APP_GUARD): every route requires a valid
 * bearer token unless the handler or its controller is decorated with @Public().
 * It authenticates only. Role checks stay on RoleGuard/@Roles.
 */
@Injectable()
export class GlobalAuthGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly authTokenGuard: AuthTokenGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    return this.authTokenGuard.canActivate(context);
  }
}
