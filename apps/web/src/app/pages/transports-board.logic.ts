import type { GatheringCar, ServeTarget } from './transports-api.service';

/** Clé stable d'une cible à desservir (groupe d'hébergement ou hébergement collectif isolé). */
export function targetKey(t: Pick<ServeTarget, 'targetType' | 'id'>): string {
  return `${t.targetType}:${t.id}`;
}

/** Cibles visibles dans le panneau de gauche : recherche par nom ou détail. */
export function filterTargets(targets: ServeTarget[], search: string): ServeTarget[] {
  const q = search.trim().toLowerCase();
  if (!q) return targets;
  return targets.filter((t) => `${t.name} ${t.detail}`.toLowerCase().includes(q));
}

/** Cibles affectées lors d'un glisser-déposer : la sélection si la ligne en fait partie, sinon la ligne seule. */
export function dragPayload(selected: ReadonlySet<string>, dragged: ServeTarget): string[] {
  const key = targetKey(dragged);
  return selected.has(key) ? [...selected] : [key];
}

export function gaugeState(car: Pick<GatheringCar, 'occupancy' | 'capacity'>): 'none' | 'ok' | 'full' | 'over' {
  if (car.capacity === null) return 'none';
  if (car.occupancy > car.capacity) return 'over';
  return car.occupancy === car.capacity ? 'full' : 'ok';
}

export function jaugePercent(car: Pick<GatheringCar, 'occupancy' | 'capacity'>): number {
  if (!car.capacity) return 0;
  return Math.min(100, Math.round((car.occupancy / car.capacity) * 100));
}

/** Personnes de la sélection (somme des effectifs des cibles cochées), pour l'indication du panneau. */
export function selectionPersonCount(targets: ServeTarget[], selected: ReadonlySet<string>): number {
  return targets.filter((t) => selected.has(t.key)).reduce((sum, t) => sum + t.personCount, 0);
}

/** Résumé des arrêts : « 07:30 Zone Nord · 08:15 Lieu du rassemblement ». */
export function stopsSummary(stops: Pick<GatheringCar, 'stops'>['stops']): string {
  return [...stops]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((s) => (s.time ? `${s.time} ${s.label}` : s.label))
    .join(' · ');
}

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' });

/** Jours de circulation lisibles : « 31/10 · 01/11 » ; vide = non planifié. */
export function serviceDatesSummary(dates: string[] | null): string {
  if (!dates || !dates.length) return 'Jours non planifiés';
  return dates
    .map((d) => {
      const date = new Date(`${d}T00:00:00`);
      return Number.isNaN(date.getTime()) ? d : DATE_FMT.format(date);
    })
    .join(' · ');
}
