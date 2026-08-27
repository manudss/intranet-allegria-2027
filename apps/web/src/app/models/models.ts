export enum ParticipantSex {
  FEMALE = 'FEMALE',
  MALE = 'MALE',
  OTHER = 'OTHER',
  UNDISCLOSED = 'UNDISCLOSED',
}
export enum MejAgeGroup {
  TA = 'TA',
  ES = 'ES',
}
export enum AssignmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}
export type PersonType = 'JEUNE' | 'ANIMATEUR' | 'BENEVOLE';
export type HostFamilyStatus = 'DRAFT' | 'VALIDATED' | 'INACTIVE';
export enum TeamParticipantRole {
  MEMBER = 'MEMBER',
  ASSISTANT = 'ASSISTANT',
}

export enum VolunteerSkillType {
  SECURITY = 'SECURITY',
  ANIMATION = 'ANIMATION',
  LITURGY = 'LITURGY',
  LOGISTICS = 'LOGISTICS',
  HEALTH = 'HEALTH',
  RECEPTION = 'RECEPTION',
  TRANSPORT = 'TRANSPORT',
  ACCOMMODATION = 'ACCOMMODATION',
  COMMUNICATION = 'COMMUNICATION',
  CATERING = 'CATERING',
  CLEANING = 'CLEANING',
  MISCELLANEOUS = 'MISCELLANEOUS',
  OTHER = 'OTHER',
}

export enum VolunteerMissionStatus {
  DRAFT = 'DRAFT',
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
  NOT_DONE = 'NOT_DONE',
}

export enum VolunteerShiftStatus {
  TODO = 'TODO',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
  NOT_DONE = 'NOT_DONE',
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
  mejAgeGroup: MejAgeGroup | null;
  type: PersonType;
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
  teamMemberships?: VolunteerTeamMembership[];
  skills?: VolunteerSkill[];
  tags?: VolunteerTag[];
}
export interface VolunteerTeam {
  id: number;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  memberships?: VolunteerTeamMembership[];
}
export interface VolunteerTeamMembership {
  id: number;
  volunteerId: number;
  volunteerTeamId: number;
  volunteer: Volunteer;
  volunteerTeam: VolunteerTeam;
  startAt: string | null;
  endAt: string | null;
  role: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface VolunteerSkill {
  id: number;
  volunteerId: number;
  skill: VolunteerSkillType;
  createdAt: string;
}
export interface VolunteerMission {
  id: number;
  title: string;
  description: string | null;
  volunteerTeamId: number | null;
  volunteerTeam: VolunteerTeam | null;
  location: string | null;
  responsibleVolunteerId: number | null;
  responsibleVolunteer: Volunteer | null;
  status: VolunteerMissionStatus;
  isOptional: boolean;
  createdAt: string;
  updatedAt: string;
  shifts?: VolunteerShift[];
}
export interface VolunteerShift {
  id: number;
  missionId: number;
  mission?: VolunteerMission;
  startAt: string;
  endAt: string;
  location: string | null;
  capacity: number | null;
  status: VolunteerShiftStatus;
  isOptional: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface VolunteerTag {
  id: number;
  volunteerId: number;
  value: string;
  createdAt: string;
}
export interface SkillCount {
  skill: VolunteerSkillType;
  count: number;
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
  latitude: number | null;
  longitude: number | null;
  maxAnimators: number | null;
  constraints: string[] | null;
  tags: string[] | null;
  status: HostFamilyStatus;
}
export interface ParticipantHostFamilyAssignment {
  id: number;
  participant: Participant;
  hostFamily: HostFamily;
  arrivalDate: string;
  departureDate: string;
  status: AssignmentStatus;
  notes: string | null;
  type: PersonType;
  groupId: number | null;
  roomLabel: string | null;
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

export type ParticipantPayload = Pick<Participant, 'firstName' | 'lastName' | 'dateOfBirth' | 'sex'> & { mejAgeGroup: MejAgeGroup | null; emergencyContactName:string; emergencyContactPhone:string; diocese:string; city:string; groupId: number | null };
export interface GroupPayload { name:string; diocese:string; arrivalDatetime:string; departureDatetime:string; notes:string }
export type VolunteerPayload = Pick<Volunteer, 'firstName' | 'lastName' | 'isGroupLeader'> & { userId: number | null; phone:string; email:string; team:string; notes:string };
export type VolunteerTeamPayload = Pick<VolunteerTeam, 'name' | 'code' | 'isActive'> & {
  description: string;
};
export type VolunteerTeamMembershipPayload = {
  volunteerTeamId: number | null;
  startAt: string | null;
  endAt: string | null;
  role: string;
};
export type VolunteerSkillPayload = { skill: VolunteerSkillType };
export type VolunteerTagPayload = { value: string };
export type VolunteerMissionPayload = {
  title: string;
  description: string;
  volunteerTeamId: number | null;
  location: string;
  responsibleVolunteerId: number | null;
  status: VolunteerMissionStatus;
  isOptional: boolean;
};
export type VolunteerShiftPayload = {
  startAt: string;
  endAt: string;
  location: string | null;
  capacity: number | null;
  status: VolunteerShiftStatus;
  isOptional: boolean;
  notes: string | null;
};
export type TeamPayload = Pick<Team, 'name' | 'maxSize'> & {
  notes: string;
  groupId: number | null;
  primaryAnimatorId: number | null;
  secondaryAnimatorId: number | null;
};
export type HostFamilyPayload = Pick<HostFamily,'familyName'|'address'|'postalCode'|'city'|'maxCapacity'|'maxUnder18'|'latitude'|'longitude'|'maxAnimators'|'constraints'|'tags'|'status'> & {phone:string;email:string;parish:string;notes:string};
export type AssignmentPayload = Pick<ParticipantHostFamilyAssignment,'arrivalDate'|'departureDate'|'status'|'type'|'groupId'|'roomLabel'> & { notes:string; participantId: number; hostFamilyId: number };
export interface ParticipantSearchResult { items: Participant[]; total: number; limit: number; offset: number }
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
