/** Groupes de rassemblement : modèles de l'API /api/gathering. */

export type GatheringCategory = 'TA' | 'ES' | 'MIXTE';
export type Track = 'TA' | 'ES' | 'COMMON';

export interface GatheringSequenceRef {
  id: number;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  track: Track;
  location: string;
}

export interface GatheringGroupSummary {
  id: number;
  name: string;
  category: GatheringCategory;
  location: string | null;
  jeunes: number;
  animateurs: number;
  persons: number;
  teamCount: number;
  capacity: number | null;
  overflow: boolean;
  almostFull: boolean;
  teamIds?: number[];
  /** Détail des équipes placées (présent sur le board de dispatch). */
  teams?: GatheringBoardPlacedTeam[];
}

/** Appartenance d'une équipe à un groupe d'une autre répartition. */
export interface GatheringOtherGroup {
  groupId: number;
  groupName: string;
  category: GatheringCategory;
  repartitionId: number;
  repartitionName: string;
}

export interface GatheringBoardPlacedTeam {
  id: number;
  name: string;
  track: Track;
  persons: number;
  otherGroups?: GatheringOtherGroup[];
}

export interface GatheringRepartition {
  id: number;
  name: string;
  notes: string | null;
  allowOverflow: boolean;
  countAnimators: boolean;
  programSequenceId: number | null;
  sequence?: GatheringSequenceRef | null;
  groups: GatheringGroupSummary[];
}

export interface GatheringBoardTeam {
  id: number;
  name: string;
  track: Track;
  jeunes: number;
  animateurs: number;
  persons: number;
  otherGroups: GatheringOtherGroup[];
}

export interface GatheringBoard {
  repartition: {
    id: number;
    name: string;
    allowOverflow: boolean;
    countAnimators: boolean;
    programSequenceId: number | null;
  };
  groups: GatheringGroupSummary[];
  unplacedTeams: GatheringBoardTeam[];
  /** Groupes des autres répartitions, pour filtrer par autre appartenance. */
  otherGroups: GatheringOtherGroup[];
}

export interface GatheringProposal {
  assignments: { teamId: number; groupId: number; groupName: string }[];
  unplaced: { teamId: number; teamName: string; reason: string }[];
}

export interface GatheringFicheTeam {
  id: number;
  name: string;
  track: Track;
  jeunes: number;
  animateurs: number;
  persons: number;
}

export interface GatheringFichePerson {
  id: number;
  firstName: string;
  teamId: number;
  teamName: string;
  mejAgeGroup: 'TA' | 'ES' | null;
}

export interface GatheringFiche {
  id: number;
  name: string;
  category: GatheringCategory;
  location: string | null;
  notes: string | null;
  jeunes: number;
  animateurs: number;
  persons: number;
  teamCount: number;
  capacity: number | null;
  overflow: boolean;
  almostFull: boolean;
  repartition: {
    id: number;
    name: string;
    allowOverflow: boolean;
    countAnimators: boolean;
  };
  sequence: GatheringSequenceRef | null;
  hostingGroup: { id: number; name: string } | null;
  documentLink: { id: number; title: string; url: string } | null;
  teams: GatheringFicheTeam[];
  people: GatheringFichePerson[];
  animators: { id: number; displayName: string; teamId: number; teamName: string }[];
  volunteerTeams: { id: number; name: string; typeLabel: string | null; memberCount: number }[];
  managers: { userId: number; email: string; displayName: string | null }[];
  alerts: GatheringAlert[];
}

export type GatheringAlert =
  | { kind: 'OVERFLOW'; groupId: number; message: string }
  | { kind: 'ALMOST_FULL'; groupId: number; message: string }
  | { kind: 'TEAM_WITHOUT_TRACK'; groupId: number; teamId: number; message: string }
  | {
      kind: 'SEQUENCE_OVERLAP';
      teamId: number;
      repartitionId: number;
      otherRepartitionId: number;
      message: string;
    };

export const CATEGORY_LABELS: Record<GatheringCategory, string> = {
  TA: 'TA',
  ES: 'ES',
  MIXTE: 'Mixte',
};

export const TRACK_LABELS: Record<Track, string> = {
  TA: 'TA',
  ES: 'ES',
  COMMON: 'Piste à renseigner',
};

export const GATHERING_CATEGORIES: GatheringCategory[] = ['TA', 'ES', 'MIXTE'];

/** Couleurs de piste, reprises de features/program/programme.ts. */
export const TRACK_COLORS: Record<Track, string> = {
  TA: '#fe0002',
  ES: '#00b2b2',
  COMMON: '#6b5f52',
};

/** Un groupe de rassemblement avec sa répartition et le créneau auquel elle est liée : base du sélecteur. */
export interface GatheringGroupOption {
  groupId: number;
  name: string;
  category: GatheringCategory;
  location: string | null;
  teamCount: number;
  persons: number;
  capacity: number | null;
  overflow: boolean;
  almostFull: boolean;
  repartitionId: number;
  repartitionName: string;
  /** Créneau de l'agenda auquel la répartition est déjà liée, s'il y en a un. */
  sequence: GatheringSequenceRef | null;
}

export function toGroupOptions(repartitions: GatheringRepartition[]): GatheringGroupOption[] {
  return repartitions.flatMap((r) =>
    r.groups.map((g) => ({
      groupId: g.id,
      name: g.name,
      category: g.category,
      location: g.location,
      teamCount: g.teamCount,
      persons: g.persons,
      capacity: g.capacity,
      overflow: g.overflow,
      almostFull: g.almostFull,
      repartitionId: r.id,
      repartitionName: r.name,
      sequence: r.sequence ?? null,
    })),
  );
}

/** État d'un groupe pour les filtres et les pastilles. */
export type GroupState = 'EMPTY' | 'FREE' | 'ALMOST' | 'FULL';

export function groupState(g: { teamCount: number; overflow: boolean; almostFull: boolean; capacity: number | null; persons: number }): GroupState {
  if (g.overflow || (g.capacity != null && g.persons >= g.capacity)) return 'FULL';
  if (g.almostFull) return 'ALMOST';
  return g.teamCount === 0 ? 'EMPTY' : 'FREE';
}

export const GROUP_STATE_LABELS: Record<GroupState, string> = {
  EMPTY: 'Vide',
  FREE: 'Places libres',
  ALMOST: 'Presque complet',
  FULL: 'Complet ou dépassé',
};
