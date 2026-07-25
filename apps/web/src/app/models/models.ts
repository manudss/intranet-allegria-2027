export enum ParticipantSex {
  FEMALE = 'FEMALE',
  MALE = 'MALE',
  OTHER = 'OTHER',
  UNDISCLOSED = 'UNDISCLOSED',
}
export enum AssignmentStatus {
  PLANNED = 'PLANNED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}
export enum TeamParticipantRole {
  MEMBER = 'MEMBER',
  ASSISTANT = 'ASSISTANT',
}

export interface Group {
  id: number;
  name: string;
  diocese: string | null;
  arrivalDatetime: string | null;
  departureDatetime: string | null;
  notes: string | null;
}
export interface Participant {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: ParticipantSex;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  diocese: string | null;
  city: string | null;
  group: Group | null;
}
export interface User {
  id: number;
  email: string;
  roles: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
export interface Role {
  id: number;
  code: string;
  label: string;
}
export interface Volunteer {
  id: number;
  user: User | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  team: string | null;
  isGroupLeader: boolean;
  notes: string | null;
}
export interface Team {
  id: number;
  name: string;
  group: Group | null;
  primaryAnimator: Volunteer | null;
  secondaryAnimator: Volunteer | null;
  maxSize: number;
  notes: string | null;
}
export interface TeamParticipant {
  id: number;
  team: Team;
  participant: Participant;
  role: TeamParticipantRole;
  notes: string | null;
}
export interface HostFamily {
  id: number;
  familyName: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string | null;
  email: string | null;
  maxCapacity: number;
  maxUnder18: number;
  parish: string | null;
  notes: string | null;
}
export interface ParticipantHostFamilyAssignment {
  id: number;
  participant: Participant;
  hostFamily: HostFamily;
  arrivalDate: string;
  departureDate: string;
  status: AssignmentStatus;
  notes: string | null;
}
export interface ParticipantHealth {
  id: number;
  participant: Participant;
  medicalConditions: string | null;
  allergies: string | null;
  medications: string | null;
  specialNeeds: string | null;
  dietaryNotes: string | null;
  emergencyInstructions: string | null;
  lastUpdatedAt: string | null;
  lastUpdatedBy: User | null;
}

export type ParticipantPayload = Pick<Participant, 'firstName' | 'lastName' | 'dateOfBirth' | 'sex'> & { emergencyContactName:string; emergencyContactPhone:string; diocese:string; city:string; groupId: number | null };
export interface GroupPayload { name:string; diocese:string; arrivalDatetime:string; departureDatetime:string; notes:string }
export type VolunteerPayload = Pick<Volunteer, 'firstName' | 'lastName' | 'isGroupLeader'> & { userId: number | null; phone:string; email:string; team:string; notes:string };
export type TeamPayload = Pick<Team, 'name' | 'maxSize'> & {
  notes: string;
  groupId: number | null;
  primaryAnimatorId: number | null;
  secondaryAnimatorId: number | null;
};
export type HostFamilyPayload = Pick<HostFamily,'familyName'|'address'|'postalCode'|'city'|'maxCapacity'|'maxUnder18'> & {phone:string;email:string;parish:string;notes:string};
export type AssignmentPayload = Pick<ParticipantHostFamilyAssignment,'arrivalDate'|'departureDate'|'status'> & { notes:string; participantId: number; hostFamilyId: number };
export interface ParticipantHealthPayload {medicalConditions:string;allergies:string;medications:string;specialNeeds:string;dietaryNotes:string;emergencyInstructions:string}
export interface LoginCredentials {
  email: string;
  password: string;
}
export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  user: User;
}
export interface DeleteResponse {
  deleted: true;
}
