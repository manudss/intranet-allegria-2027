export type SexMixingRule = 'ignore' | 'avoid' | 'forbid';

export interface PlacementRules {
  countAnimatorsInCapacity: boolean;
  sexMixing: SexMixingRule;
}

export type HostingGroupKind = 'ZONE' | 'PARISH' | 'OTHER';

export interface HostingGroup {
  id: number;
  name: string;
  notes: string | null;
  kind?: HostingGroupKind;
  color?: string | null;
}

export interface HostingGroupSummary extends HostingGroup {
  kind: HostingGroupKind;
  familyCount: number;
  seats: number;
  collectiveCount: number;
}

export interface BoardTeam {
  id: number;
  name: string;
  groupName: string | null;
  hostingGroupId: number | null;
  memberCount: number;
}

export interface BoardMember {
  participantId: number;
  firstName: string;
  lastName: string;
  sex: string;
  type: string;
  dateOfBirth: string;
  teamId: number;
  assignmentId: number | null;
  hostFamilyId: number | null;
  assignmentStatus: string | null;
}

export interface BoardFamily {
  id: number;
  familyName: string;
  city: string;
  parish: string | null;
  accommodationType?: 'FAMILY' | 'COLLECTIVE';
  latitude?: number | null;
  longitude?: number | null;
  maxCapacity: number;
  maxUnder18: number;
  maxAnimators: number | null;
  status: string;
  hostingGroupId: number | null;
  constraints: string[];
  tags: string[];
}

export interface BoardConflict {
  participantId: number;
  teamId: number;
  hostFamilyId: number;
  reason: string;
}

export interface Board {
  hostingGroups: HostingGroup[];
  teams: BoardTeam[];
  members: BoardMember[];
  families: BoardFamily[];
  conflicts: BoardConflict[];
}

export interface AutoPlaceResult {
  applied: boolean;
  proposals: { participantId: number; hostFamilyId: number; needsReview: boolean }[];
  unplaced: { participantId: number; reason: string }[];
}

export interface PlaceResult {
  assignment: { id: number; status: string; hostFamily: { id: number } };
  warnings: string[];
}
