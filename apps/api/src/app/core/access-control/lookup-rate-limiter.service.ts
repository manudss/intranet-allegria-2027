import { Injectable } from '@nestjs/common';
import { LOOKUP_RATE_LIMIT_PER_MINUTE } from './access-control.constants';

/**
 * Limitation de débit du repli en ligne (proposition du plan : encadrer la
 * porte ouverte par l'interrogation de la base pour un code inconnu).
 * En mémoire, par utilisateur : suffisant pour un déploiement mono-instance.
 */
@Injectable()
export class LookupRateLimiterService {
  private readonly hits = new Map<number, number[]>();

  /** true si l'appel est autorisé ; false si le débit est dépassé. */
  tryConsume(userId: number, now = Date.now()): boolean {
    const windowStart = now - 60_000;
    const recent = (this.hits.get(userId) ?? []).filter((ts) => ts > windowStart);
    if (recent.length >= LOOKUP_RATE_LIMIT_PER_MINUTE) {
      this.hits.set(userId, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(userId, recent);
    return true;
  }

  /** Test hook. */
  reset(): void {
    this.hits.clear();
  }
}
