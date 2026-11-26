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

export interface GatheringBoardPlacedTeam {
  id: number;
  name: string;
  track: Track;
  persons: number;
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
  delegation: string | null;
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
}

export interface GatheringProposal {
  assignments: { teamId: number; groupId: number; groupName: string }[];
  unplaced: { teamId: number; teamName: string; reason: string }[];
}

export interface GatheringFicheTeam {
  id: number;
  name: string;
  track: Track;
  delegation: string | null;
  jeunes: number;
  animateurs: number;
  persons: number;
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
  people: { id: number; firstName: string }[];
  animators: { id: number; displayName: string }[];
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
