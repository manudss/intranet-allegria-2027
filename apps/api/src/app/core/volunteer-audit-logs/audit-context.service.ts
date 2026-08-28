import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

type AuditContextState = {
  userId: number | null;
};

@Injectable()
export class AuditContextService {
  private readonly storage = new AsyncLocalStorage<AuditContextState>();

  runWithUser<T>(userId: number | null, callback: () => T): T {
    return this.storage.run({ userId }, callback);
  }

  getUserId(): number | null {
    return this.storage.getStore()?.userId ?? null;
  }
}

