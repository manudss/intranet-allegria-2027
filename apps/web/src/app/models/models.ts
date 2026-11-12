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

export enum VolunteerShiftAssignmentStatus {
  PROVISIONAL = 'PROVISIONAL',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export enum VolunteerAuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATUS_CHANGED = 'STATUS_CHANGED',
  ASSIGNMENT_CHANGED = 'ASSIGNMENT_CHANGED',
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
  /** Null pour les fiches BENEVOLE (adultes, projection d'un bénévole). */
  dateOfBirth: string | null;
  /** Null pour les fiches BENEVOLE. */
  sex: ParticipantSex | null;
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
  assignments?: VolunteerShiftAssignment[];
  activeAssignmentsCount?: number;
  confirmedAssignmentsCount?: number;
}
export interface VolunteerShiftAssignment {
  id: number;
  volunteerId: number;
  volunteer: Volunteer;
  shiftId: number;
  shift?: VolunteerShift;
  status: VolunteerShiftAssignmentStatus;
  assignedByUserId: number;
  assignedByUser: User;
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
export interface VolunteerAuditLog {
  id: number;
  userId: number;
  user: User;
  action: VolunteerAuditAction;
  entityType: string;
  entityId: number;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
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
/** Affectation d'un bénévole à une équipe de rassemblement, en tant qu'adulte. */
export interface BenevoleAssignment {
  volunteerId: number;
  participantId: number;
  teamId: number;
  teamName: string;
  firstName: string;
  lastName: string;
  mission: string | null;
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
  accommodationType?: 'FAMILY' | 'COLLECTIVE';
  hostingGroupId?: number | null;
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

export type ParticipantPayload = Pick<
  Participant,
  'firstName' | 'lastName' | 'dateOfBirth' | 'sex'
> & {
  mejAgeGroup: MejAgeGroup | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  diocese: string;
  city: string;
  groupId: number | null;
};
export interface GroupPayload {
  name: string;
  diocese: string;
  arrivalDatetime: string;
  departureDatetime: string;
  notes: string;
}
export type VolunteerPayload = Pick<Volunteer, 'firstName' | 'lastName' | 'isGroupLeader'> & {
  userId: number | null;
  phone: string;
  email: string;
  team: string;
  notes: string;
};
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
export type VolunteerShiftAssignmentPayload = {
  volunteerId: number;
  status: VolunteerShiftAssignmentStatus;
  notes: string | null;
  force?: boolean;
};
export type VolunteerShiftAssignmentStatusPayload = {
  status: VolunteerShiftAssignmentStatus;
  notes?: string | null;
  force?: boolean;
};
export type VolunteerShiftAssignmentSearchParams = {
  shiftId?: number;
  q?: string;
  skill?: VolunteerSkillType | null;
  tag?: string;
  volunteerTeamId?: number | null;
  availableOnly?: boolean;
  startAt?: string;
  endAt?: string;
};
export interface VolunteerShiftAssignmentVolunteerSearchResult {
  volunteer: Volunteer;
  hasOverlap: boolean;
}
export type TeamPayload = Pick<Team, 'name' | 'maxSize'> & {
  notes: string;
  groupId: number | null;
  primaryAnimatorId: number | null;
  secondaryAnimatorId: number | null;
};
export type HostFamilyPayload = Pick<
  HostFamily,
  | 'familyName'
  | 'address'
  | 'postalCode'
  | 'city'
  | 'maxCapacity'
  | 'maxUnder18'
  | 'latitude'
  | 'longitude'
  | 'maxAnimators'
  | 'constraints'
  | 'tags'
  | 'status'
  | 'accommodationType'
> & { phone: string; email: string; parish: string; notes: string };
export type AssignmentPayload = Pick<
  ParticipantHostFamilyAssignment,
  'arrivalDate' | 'departureDate' | 'status' | 'type' | 'groupId' | 'roomLabel'
> & { notes: string; participantId: number; hostFamilyId: number };
export interface ParticipantSearchResult {
  items: Participant[];
  total: number;
  limit: number;
  offset: number;
}
export interface ParticipantHealthPayload {
  medicalConditions: string;
  allergies: string;
  medications: string;
  specialNeeds: string;
  dietaryNotes: string;
  emergencyInstructions: string;
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
export interface DeleteResponse {
  deleted: true;
}
export interface StatusCounters {
  missions: Record<VolunteerMissionStatus, number>;
  shifts: Record<VolunteerShiftStatus, number>;
}
export interface VolunteerAuditLogSearchResult {
  items: VolunteerAuditLog[];
  total: number;
  limit: number;
  offset: number;
}
export type VolunteerAuditLogSearchParams = {
  limit?: number;
  offset?: number;
  userId?: number | null;
  action?: VolunteerAuditAction | null;
  entityType?: string;
  from?: string;
  to?: string;
};
export type VolunteerMissionStatusPayload = {
  status: VolunteerMissionStatus;
  reason?: string | null;
  force?: boolean;
};
export type VolunteerShiftStatusPayload = {
  status: VolunteerShiftStatus;
  reason?: string | null;
  force?: boolean;
};

// ─── Tableau de bord opérationnel Jour J ─────────────────────────────────────

export interface DashboardShiftsByStatus {
  TODO: number;
  ASSIGNED: number;
  IN_PROGRESS: number;
  DONE: number;
  CANCELLED: number;
  NOT_DONE: number;
}

export interface DashboardGlobalSummary {
  date: string;
  missionCount: number;
  shiftCount: number;
  shiftsByStatus: DashboardShiftsByStatus;
  shiftsWithoutConfirmedAssignment: number;
  understaffedShifts: number;
  assignedVolunteers: number;
  provisionalVolunteers: number;
}

export interface DashboardTeamSummary {
  teamId: number;
  teamName: string;
  teamCode: string;
  missionCount: number;
  shiftsByStatus: DashboardShiftsByStatus;
  totalCapacity: number;
  confirmedVolunteers: number;
  provisionalVolunteers: number;
  alerts: string[];
}

export interface DashboardLocationRow {
  location: string;
  shiftsInProgress: number;
  shiftsUpcoming: number;
  assignedVolunteers: number;
  alerts: string[];
}

export interface DashboardWhoDoesWhatShift {
  shiftId: number;
  missionTitle: string;
  missionId: number;
  startAt: string;
  endAt: string;
  location: string | null;
  teamName: string | null;
  assignmentStatus: string;
  shiftStatus: VolunteerShiftStatus;
}

export interface DashboardWhoDoesWhatItem {
  volunteerId: number;
  firstName: string;
  lastName: string;
  shifts: DashboardWhoDoesWhatShift[];
}

export interface DashboardWhoDoesWhatResult {
  items: DashboardWhoDoesWhatItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface DashboardTodoMission {
  missionId: number;
  title: string;
  teamName: string | null;
  location: string | null;
  shiftCount: number;
}

// ─── Module Programme (planification en chaîne des séquences) ──

export enum ProgramSequenceStatus {
  MOBILE = 'MOBILE',
  FROZEN = 'FROZEN',
}

export interface ProgramDocumentLink {
  label: string;
  url: string;
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
  minDurationMinutes: number | null;
  minMarginMinutes: number | null;
  /** Prédécesseur dans la chaîne principale du lieu/jour ; null = tête de chaîne */
  previousSequenceId: number | null;
  /** Repère commun utilisé pour rattacher des branches parallèles */
  anchorSequenceId: number | null;
  volunteerTeamId: number | null;
  volunteerTeamName: string | null;
  missionIds: number[];
  documentLinks: ProgramDocumentLink[];
  notes: string | null;
  frozenByUserId: number | null;
  frozenByUserName: string | null;
  frozenAt: string | null;
}

export interface ProgramDay {
  date: string;
  sequences: ProgramSequence[];
}

/** Corps des requêtes d'insertion (aperçu et application). */
export interface ProgramSequenceDraft {
  title: string;
  durationMinutes: number;
  volunteerTeamId: number | null;
  notes: string | null;
  minDurationMinutes?: number | null;
  minMarginMinutes?: number | null;
}

export interface ProgramSequenceDiff {
  sequenceId: number;
  title: string;
  before: { startTime: string; endTime: string; durationMinutes: number };
  after: { startTime: string; endTime: string; durationMinutes: number };
}

export type ProgramRecalcOutcome = 'ok' | 'partial' | 'impossible';

export interface ProgramInsertPreview {
  kind: 'insert';
  afterSequenceId: number;
  draft: ProgramSequenceDraft;
  /** Séquence à créer (sans id : attribué à l'application par le serveur). */
  newSequence: Pick<
    ProgramSequence,
    'eventDate' | 'location' | 'title' | 'startTime' | 'endTime' | 'durationMinutes'
  >;
  affected: ProgramSequenceDiff[];
  outcome: ProgramRecalcOutcome;
  message: string;
  /** Empreinte de la chaîne, à renvoyer à l'application pour détecter une modification concurrente. */
  version: string;
}

export interface ProgramResizePreview {
  kind: 'resize';
  sequenceId: number;
  previousDurationMinutes: number;
  newDurationMinutes: number;
  affected: ProgramSequenceDiff[];
  stoppedAtFrozenId: number | null;
  marginMinutes: number | null;
  outcome: ProgramRecalcOutcome;
  message: string;
  version: string;
}

export type ProgramPreview = ProgramInsertPreview | ProgramResizePreview;

export type ProgramChangeLogAction =
  'INSERT' | 'RESIZE' | 'MOVE' | 'FREEZE' | 'UNFREEZE' | 'DELETE' | 'UPDATE';

/** Création de la première séquence d'un jour/lieu (ou tête d'une branche rattachée à un repère). */
export interface ProgramSequenceCreatePayload {
  eventDate: string;
  location: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  volunteerTeamId?: number | null;
  notes?: string | null;
  anchorSequenceId?: number | null;
}

/** Champs descriptifs modifiables d'une séquence (les horaires passent par insert/resize). */
export interface ProgramSequenceUpdatePayload {
  title?: string;
  notes?: string | null;
  volunteerTeamId?: number | null;
  minDurationMinutes?: number | null;
  minMarginMinutes?: number | null;
  missionIds?: number[];
  documentLinks?: ProgramDocumentLink[];
}

export interface ProgramChangeLogEntry {
  id: number;
  action: ProgramChangeLogAction;
  eventDate: string;
  authorUserId: number;
  authorUserName: string | null;
  createdAt: string;
  affectedSequenceIds: number[];
  comment: string | null;
}

export interface DashboardTodoShift {
  shiftId: number;
  missionTitle: string;
  missionId: number;
  startAt: string;
  endAt: string;
  location: string | null;
  capacity: number | null;
  activeCount: number;
  confirmedCount: number;
}

export interface DashboardTodoList {
  mandatoryIncomplete: DashboardTodoMission[];
  unstarted: DashboardTodoShift[];
  withoutConfirmedStaff: DashboardTodoShift[];
  optionalIncomplete: DashboardTodoMission[];
}

// ── Répartition bénévoles → équipes de rassemblement (benevoles/repartition) ─

export interface RepartitionTeamRow {
  id: number;
  name: string;
  groupId: number | null;
  groupName: string | null;
  hostingGroupId: number | null;
  hostingGroupName: string | null;
  jeunes: number;
  adultes: number;
  maxSize: number;
  free: number;
}

export interface RepartitionVolunteerRow {
  id: number;
  firstName: string;
  lastName: string;
  mission: string | null;
  poles: string[];
  skills: string[];
  tags: string[];
  teamId: number | null;
  teamName: string | null;
}

// ── Répartition jeunes/animateurs → équipes de rassemblement ────────────────

export interface JeunesRepartitionFilters {
  groups: { id: number; name: string }[];
  cities: string[];
  dioceses: string[];
  ageGroups: MejAgeGroup[];
}

/**
 * Un participant (jeune ou animateur) de la page de répartition.
 * Confidentialité mineurs : lastName vaut toujours null pour un jeune.
 */
export interface JeunesRepartitionParticipantRow {
  id: number;
  type: 'JEUNE' | 'ANIMATEUR';
  firstName: string;
  lastName: string | null;
  age: number | null;
  sex: ParticipantSex | null;
  mejAgeGroup: MejAgeGroup | null;
  groupId: number | null;
  groupName: string | null;
  city: string | null;
  diocese: string | null;
  teamId: number | null;
  teamName: string | null;
}

export interface RepartitionVolunteersResult {
  total: number;
  volunteers: RepartitionVolunteerRow[];
}

export interface RepartitionFilters {
  hostingGroups: { id: number; name: string }[];
  groups: { id: number; name: string }[];
  poles: { id: number; name: string }[];
  tags: string[];
  skills: string[];
}

export interface ApplyRepartitionEntry {
  volunteerId: number;
  teamId: number | null;
}

export interface ApplyRepartitionResult {
  applied: number;
}
export interface JeunesRepartitionParticipantsResult {
  total: number;
  participants: JeunesRepartitionParticipantRow[];
}

export interface JeunesRepartitionTeamRow {
  id: number;
  name: string;
  maxSize: number;
  groupId: number | null;
  groupName: string | null;
  jeunesCount: number;
  adultesCount: number;
  totalCount: number;
}

export interface BulkCreateTeamsResult {
  created: { id: number; name: string; maxSize: number }[];
}

export type JeunesRepartitionAgeMode = 'tranches' | 'same-age' | 'mixed';
export type JeunesRepartitionSexMode = 'balanced' | 'none' | 'non-mixed';
export type JeunesRepartitionGeoGranularity = 'group' | 'city' | 'diocese';

export interface JeunesRepartitionParams {
  jeunesPerTeam: number;
  adultsPerTeam: number;
  ageMode: JeunesRepartitionAgeMode;
  sexMode: JeunesRepartitionSexMode;
  geoGranularity: JeunesRepartitionGeoGranularity;
  geoMaxPerTeam: number;
  separateAnimators: boolean;
  moveAssigned: boolean;
}

export interface JeunesProposalViolation {
  teamId: number | null;
  participantId: number | null;
  kind: 'geo' | 'animator-origin' | 'capacity';
  message: string;
}

export interface JeunesProposalTeamStat {
  teamId: number;
  jeunes: number;
  adultes: number;
  maxSize: number;
  sexes: Record<string, number>;
  tranches: Record<string, number>;
  origins: Record<string, number>;
}

export interface ProposeJeunesRepartitionResult {
  proposals: { participantId: number; teamId: number }[];
  unplaced: number[];
  violations: JeunesProposalViolation[];
  teamStats: JeunesProposalTeamStat[];
}

export interface ApplyJeunesRepartitionEntry {
  participantId: number;
  teamId: number | null;
}

export interface ApplyJeunesRepartitionResult {
  applied: number;
}
