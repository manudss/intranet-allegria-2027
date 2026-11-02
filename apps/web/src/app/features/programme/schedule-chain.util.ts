import { ProgramSequence } from '../../models/models';
import { ALLEGRIA_2027_EVENT_DATES } from '../../shared/event-date-selector/event-date.config';

/** Les 4 jours de l'événement (YYYY-MM-DD), calculés en UTC pour éviter tout décalage de fuseau. */
export const PROGRAM_EVENT_DAYS: string[] = [0, 1, 2, 3].map((offset) => {
  const [year, month, day] = ALLEGRIA_2027_EVENT_DATES.startDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
});

/** Reconstruit la chaîne ordonnée d'un jour/lieu à partir des pointeurs previousSequenceId. */
export function buildChain(
  sequences: ProgramSequence[],
  eventDate: string,
  location: string,
): ProgramSequence[] {
  const scoped = sequences.filter((s) => s.eventDate === eventDate && s.location === location);
  const byId = new Map(scoped.map((s) => [s.id, s]));
  const head = scoped.find((s) => s.previousSequenceId === null || !byId.has(s.previousSequenceId));
  if (!head) {
    return [];
  }

  const chain: ProgramSequence[] = [head];
  let current = head;
  // Garde-fou anti-boucle infinie en cas de données corrompues.
  for (let i = 0; i < scoped.length; i++) {
    const next = scoped.find((s) => s.previousSequenceId === current.id);
    if (!next) break;
    chain.push(next);
    current = next;
  }
  return chain;
}
