/** Dates par défaut d'une sous-délégation : seule l'heure reste à saisir. */
export const DEFAULT_DATE_BY_DIRECTION = {
  ALLER: '2027-10-31',
  RETOUR: '2027-11-03',
} as const;

export interface TransportTimes {
  depDate: string;
  depTime: string;
  arrDate: string;
  arrTime: string;
}

export function defaultTimes(direction: 'ALLER' | 'RETOUR'): TransportTimes {
  const date = DEFAULT_DATE_BY_DIRECTION[direction];
  return { depDate: date, depTime: '', arrDate: date, arrTime: '' };
}

/** Sépare un ISO en date et heure locales ; sans valeur, reprend la date par défaut du sens. */
export function splitIso(iso: string | null, fallbackDate: string): { date: string; time: string } {
  if (!iso) return { date: fallbackDate, time: '' };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Sans heure saisie, pas de date-heure : la date seule ne vaut pas un horaire. */
export function composeIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
