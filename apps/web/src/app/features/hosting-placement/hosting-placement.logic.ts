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
