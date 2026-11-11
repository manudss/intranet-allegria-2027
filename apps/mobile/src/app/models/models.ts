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
