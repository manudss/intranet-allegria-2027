import { HttpErrorResponse } from '@angular/common/http';
/** A429 never clears local edits and never causes an immediate retry. */
export function familyRetryDelay(error: unknown): number {
  if (!(error instanceof HttpErrorResponse) || error.status !== 429) return 0;
  const raw = error.headers.get('Retry-After');
  const seconds =
    raw && /^\d+$/.test(raw)
      ? Number(raw)
      : raw
        ? Math.ceil((Date.parse(raw) - Date.now()) / 1000)
        : 60;
  return Math.min(3600, Math.max(1, Number.isFinite(seconds) ? seconds : 60)) * 1000;
}
export function familyRateLimitMessage(delay: number) {
  return `Trop de demandes rapprochées. Attendez environ ${Math.ceil(delay / 1000)} secondes avant de réessayer. Votre saisie reste dans cette page : ne la fermez pas et ne la rechargez pas tant que la sauvegarde n'est pas confirmée.`;
}
