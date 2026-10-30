import { Board, BoardFamily, BoardMember, BoardTeam } from './hosting-placement.models';

/** Mineur à la date de référence (même règle que l'API). */
export function isMinorAt(dateOfBirth: string, referenceDate: string): boolean {
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  const eighteenth = `${String(y + 18).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return eighteenth > referenceDate;
}

export interface GroupStats {
  teams: number;
  families: number;
  people: number;
  placed: number;
  seats: number;
}

/** Places = capacité des familles validées du groupe. Personnes = membres de ses équipes. */
export function groupStats(board: Board, groupId: number | null): GroupStats {
  const teams = board.teams.filter((t) => t.hostingGroupId === groupId);
  const families = board.families.filter((f) => f.hostingGroupId === groupId);
  const teamIds = new Set(teams.map((t) => t.id));
  const members = board.members.filter((m) => teamIds.has(m.teamId));
  return {
    teams: teams.length,
    families: families.length,
    people: members.length,
    placed: members.filter((m) => m.hostFamilyId !== null).length,
    seats: families.filter((f) => f.status === 'VALIDATED').reduce((s, f) => s + f.maxCapacity, 0),
  };
}

export interface FamilyLoad {
  occupants: BoardMember[];
  used: number;
  minors: number;
  animators: number;
  full: boolean;
}

export function familyLoad(board: Board, family: BoardFamily, referenceDate: string): FamilyLoad {
  const occupants = board.members.filter((m) => m.hostFamilyId === family.id);
  const minors = occupants.filter((m) => isMinorAt(m.dateOfBirth, referenceDate)).length;
  const animators = occupants.filter((m) => m.type === 'ANIMATEUR').length;
  return {
    occupants,
    used: occupants.length,
    minors,
    animators,
    full: occupants.length >= family.maxCapacity,
  };
}

export function teamsOfGroup(board: Board, groupId: number | null): BoardTeam[] {
  return board.teams.filter((t) => t.hostingGroupId === groupId);
}

export function familiesOfGroup(board: Board, groupId: number | null): BoardFamily[] {
  return board.families.filter((f) => f.hostingGroupId === groupId);
}

/** Personnes de ces équipes qui n'ont pas encore de famille. */
export function unplacedMembers(board: Board, groupId: number): BoardMember[] {
  const teamIds = new Set(teamsOfGroup(board, groupId).map((t) => t.id));
  return board.members
    .filter((m) => teamIds.has(m.teamId) && m.hostFamilyId === null)
    .sort((a, b) => a.teamId - b.teamId || a.lastName.localeCompare(b.lastName));
}

export const REASON_LABELS: Record<string, string> = {
  NO_CAPACITY: 'Plus de place dans les familles du groupe',
  UNDER18_LIMIT: 'Limite de mineurs atteinte',
  ANIMATOR_LIMIT: "Limite d'animateurs atteinte",
  SEX_MIXING: 'Mixité refusée par la règle choisie',
};

export const needsReview = (family: BoardFamily): boolean =>
  family.constraints.length + family.tags.length > 0;

/**
 * État de remplissage d'un groupe, calculé avec les mêmes règles que la colonne :
 * personnes = membres des équipes du groupe, places = capacité des familles validées.
 * Aucun seuil inventé : seule la comparaison personnes / places compte.
 *  - empty : aucune personne à héberger
 *  - over  : plus de personnes que de places (badge « Manque n »)
 *  - full  : autant de personnes que de places
 *  - under : des places restent libres
 */
export type GroupFillState = 'empty' | 'under' | 'full' | 'over';

export interface GroupFill {
  state: GroupFillState;
  people: number;
  seats: number;
  free: number;
  missing: number;
  percent: number;
}

export function groupFill(stats: GroupStats): GroupFill {
  const { people, seats } = stats;
  const state: GroupFillState =
    people === 0 ? 'empty' : people > seats ? 'over' : people === seats ? 'full' : 'under';
  return {
    state,
    people,
    seats,
    free: Math.max(0, seats - people),
    missing: Math.max(0, people - seats),
    percent: seats <= 0 ? 0 : Math.round((people / seats) * 100),
  };
}

export const FILL_LABELS: Record<GroupFillState, string> = {
  empty: 'Vide',
  under: 'Places libres',
  full: 'Complet',
  over: 'Manque de places',
};
