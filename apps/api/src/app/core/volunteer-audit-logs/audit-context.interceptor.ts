import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuditContextService } from './audit-context.service';

type AuthenticatedUser = {
  id: number;
};

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly auditContextService: AuditContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const userId = typeof request.user?.id === 'number' ? request.user.id : null;

    return new Observable((subscriber) =>
      this.auditContextService.runWithUser(userId, () => next.handle().subscribe(subscriber)),
    );
  }
}
