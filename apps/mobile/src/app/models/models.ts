// Modèles consommés par l'app mobile (sous-ensemble des modèles de l'intranet).

export interface User {
  id: number;
  email: string;
  roles: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  user: User;
}

// ─── Programme (lecture seule) ───

export enum ProgramSequenceStatus {
  MOBILE = 'MOBILE',
  FROZEN = 'FROZEN',
}

export interface ProgramSequence {
  id: number;
  eventDate: string;
  location: string;
  title: string;
  /** Heure de début au format HH:mm */
  startTime: string;
  durationMinutes: number;
  /** Heure de fin calculée (HH:mm), dérivée de startTime + durationMinutes */
  endTime: string;
  status: ProgramSequenceStatus;
  volunteerTeamId: number | null;
  volunteerTeamName: string | null;
  notes: string | null;
}

export interface ProgramDay {
  date: string;
  sequences: ProgramSequence[];
}

export interface ProgramChangeLogEntry {
  id: number;
  action: string;
  eventDate: string;
  authorUserId: number;
  authorUserName: string | null;
  createdAt: string;
  affectedSequenceIds: number[];
  comment: string | null;
}

// ─── Mon espace (bénévole connecté) ───

export interface VolunteerSkill {
  id: number;
  skill: string;
}

export interface VolunteerTag {
  id: number;
  value: string;
}

export interface Volunteer {
  id: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  team: string | null;
  isGroupLeader: boolean;
  notes: string | null;
  skills?: VolunteerSkill[];
  tags?: VolunteerTag[];
}

/** Payload de mise à jour du profil par le bénévole (liste blanche côté API). */
export interface UpdateMyVolunteerPayload {
  phone?: string | null;
  email?: string | null;
}

export type ShiftAssignmentStatus = 'PROVISIONAL' | 'CONFIRMED' | 'CANCELLED';

export interface VolunteerMission {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  volunteerTeam?: VolunteerTeam | null;
  responsibleVolunteer?: { id: number; firstName: string; lastName: string } | null;
}

export interface VolunteerShift {
  id: number;
  startAt: string;
  endAt: string;
  location: string | null;
  mission: VolunteerMission;
}

export interface ShiftAssignment {
  id: number;
  status: ShiftAssignmentStatus;
  notes: string | null;
  shift: VolunteerShift;
}

export interface VolunteerTeam {
  id: number;
  name: string;
  code: string;
  description: string | null;
}

export interface TeamMembership {
  id: number;
  role: string | null;
  startAt: string | null;
  endAt: string | null;
  volunteerTeam: VolunteerTeam;
}

/** Équipier d'une équipe opérationnelle (coordonnées visibles au sein de l'équipe). */
export interface Teammate {
  id: number;
  role: string | null;
  volunteer: {
    id: number;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
  };
}

export type VolunteerHostingType = 'HOST_FAMILY' | 'ON_SITE' | 'OTHER';

export interface VolunteerHosting {
  id: number;
  type: VolunteerHostingType;
  locationName: string | null;
  address: string | null;
  room: string | null;
  notes: string | null;
  startAt: string | null;
  endAt: string | null;
  hostFamily: {
    id: number;
    familyName: string;
    address: string;
    postalCode: string;
    city: string;
    phone: string | null;
    email: string | null;
  } | null;
}
