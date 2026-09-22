import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization as string | undefined;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token manquant');
    }

    const token = authorization.slice('Bearer '.length).trim();

    const authenticatedUser = await this.authService.resolveToken(token);

    if (!authenticatedUser) {
      throw new UnauthorizedException('Token invalide');
    }

    request.user = authenticatedUser;

    return true;
  }
}
