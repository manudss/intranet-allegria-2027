/** Explicit Paris wall time, independent of the administrator's device timezone. */
export function parisLocal(instant: string): string {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw Error('Date invalide');
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (name: string) => parts.find((p) => p.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
export function parisInstant(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw Error('Choisissez une date et une heure complètes.');
  const naive = Date.parse(local + 'Z');
  if (!Number.isFinite(naive)) throw Error('Date invalide');
  // Enumerate the possible UTC offsets instead of silently normalizing DST gaps or folds.
  const candidates = [0, 60, 120]
    .map((minutes) => new Date(naive - minutes * 60000))
    .filter((date) => parisLocal(date.toISOString()) === local);
  if (candidates.length !== 1)
    throw Error(
      candidates.length
        ? 'Heure ambiguë au changement d’heure. Choisissez une autre heure.'
        : 'Heure inexistante ou date invalide à Paris.',
    );
  return candidates[0].toISOString();
}
