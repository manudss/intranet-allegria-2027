import type { AssignmentEntry } from './delegations-api.service';

export type RoleFilter = 'ALL' | 'PARTICIPANT' | 'VOLUNTEER';

export function entryKeyOf(e: AssignmentEntry): string {
  return e.person ? `${e.person.personType}:${e.person.id}` : String(e.assignmentId);
}

/** Personnes à placer visibles dans le panneau de gauche : recherche par nom et filtre de rôle. */
export function filterPeople(entries: AssignmentEntry[], search: string, role: RoleFilter): AssignmentEntry[] {
  const q = search.trim().toLowerCase();
  return entries.filter((e) => {
    if (!e.person) return false;
    if (role !== 'ALL' && e.person.personType !== role) return false;
    if (!q) return true;
    return `${e.person.firstName} ${e.person.lastName} ${e.person.lastName} ${e.person.firstName}`
      .toLowerCase()
      .includes(q);
  });
}

/** Personnes à affecter lors d'un glisser-déposer : la sélection si la ligne en fait partie, sinon la ligne seule. */
export function dragPayload(selected: ReadonlySet<string>, dragged: AssignmentEntry): string[] {
  const key = entryKeyOf(dragged);
  return selected.has(key) ? [...selected] : [key];
}

export function gaugeLabel(occupancy: number, capacity: number | null): string {
  return capacity === null ? `${occupancy} placés, sans jauge` : `${occupancy}/${capacity}`;
}
