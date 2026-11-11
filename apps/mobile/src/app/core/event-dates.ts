// Dates de l'événement Allegria 2027 (même source que
// apps/web/src/app/shared/event-date-selector/event-date.config.ts).
export const EVENT_START_DATE = '2027-10-30';
export const EVENT_END_DATE = '2027-11-02';


const parseDay = (iso: string): Date => new Date(`${iso}T00:00:00`);

const toIso = (date: Date): string => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Jours de l'événement, du premier (J1) au dernier (J4). */
export const eventDays = (): string[] => {
  const days: string[] = [];
  // setDate (pas +24 h) pour traverser correctement le changement d'heure du 31 octobre.
  for (
    let d = parseDay(EVENT_START_DATE);
    d <= parseDay(EVENT_END_DATE);
    d.setDate(d.getDate() + 1)
  ) {
    days.push(toIso(d));
  }
  return days;
};

/** Jour à afficher par défaut : aujourd'hui si l'événement est en cours, sinon J1. */
export const defaultDay = (today = toIso(new Date())): string => {
  const days = eventDays();
  return days.includes(today) ? today : days[0];
};

/** Libellé court d'un jour : "J1 · sam. 30 oct.". */
export const dayLabel = (iso: string): string => {
  const index = eventDays().indexOf(iso);
  const formatted = parseDay(iso).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return index >= 0 ? `J${index + 1} · ${formatted}` : formatted;
};
