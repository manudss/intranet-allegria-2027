import type { StructuredHealth } from './registration-health';
import { DIOCESES } from './dioceses';
export type RegistrationState =
  'DRAFT' | 'SUBMITTED' | 'CORRECTION' | 'VALIDATED' | 'CONFIRMED' | 'REFUSED' | 'CANCELLED';
export type SimulationState = 'NOT_TESTED' | 'SUCCESS' | 'FAILURE' | 'CANCELLED';
export interface FamilyContact {
  name: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  emergencyName: string;
  emergencyPhone: string;
}
export interface YouthIdentity {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  mejAgeGroup: string;
  dioceseId: string;
  otherDiocese: string;
  city: string;
  mejGroup: string;
  legalCapacity: string;
}
export interface YouthLogistics {
  presence: string;
  arrival: string;
  departure: string;
  transport: string;
  accommodation: string;
  notes: string;
}
export interface FamilyDocumentTemplate {
  id: string;
  title: string;
  version: string;
  text: string;
  required: boolean;
  enabled: boolean;
}
export interface SignatureAppearance {
  method: 'NAME' | 'DRAW' | 'UPLOAD';
  image?: string;
}
export interface SignatureVerification {
  method: 'EMAIL_CODE';
  challengeId: string;
  verifiedAt: string;
  context: string;
}
export interface FamilySignature {
  document?: { pdfBase64: string; digest: string };
  appearance?: SignatureAppearance;
  verification?: SignatureVerification;
  templateId: string;
  version: string;
  digest: string;
  signerName: string;
  capacity: string;
  signedAt: string;
  withdrawnAt?: string;
  snapshot?: string;
}
export interface YouthAdministrativeSnapshot {
  identity: YouthIdentity;
  logistics: YouthLogistics;
  signatures: FamilySignature[];
  simulation: SimulationState;
  paperHealth: 'TO_ORGANISE' | 'RECEIVED';
  submittedAt: string | null;
  participantId: number | null;
}
export interface YouthDossier {
  id: string;
  identity: YouthIdentity;
  logistics: YouthLogistics;
  state: RegistrationState;
  revision: number;
  currentPage: number;
  signatures: FamilySignature[];
  simulation: SimulationState;
  paperHealth: 'TO_ORGANISE' | 'RECEIVED';
  correction: string;
  submittedAt: string | null;
  participantId: number | null;
  contactAtSubmission?: FamilyContact;
  administrativeAtSubmission?: YouthAdministrativeSnapshot;
}
export interface FamilySpace {
  id: string;
  email: string;
  contact: FamilyContact;
  youths: YouthDossier[];
  revision: number;
  updatedAt: string;
}
export interface FamilyRules {
  previewDemo?: boolean;
  previewMailEnabled?: boolean;
  previewHealthSamples?: Record<string, StructuredHealth>;
  ageReferenceDate: string;
  minAge: number | null;
  maxAge: number | null;
  healthMode: 'PAPER' | 'DIGITAL_APPROVED' | 'DIGITAL_DEMO';
  healthNotice: string;
  templates: FamilyDocumentTemplate[];
  registrationOpen: boolean;
  finalDeclaration: string;
}
export const EMPTY_CONTACT: FamilyContact = {
  name: '',
  phone: '',
  address: '',
  postalCode: '',
  city: '',
  emergencyName: '',
  emergencyPhone: '',
};
export const EMPTY_IDENTITY: YouthIdentity = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  sex: '',
  mejAgeGroup: '',
  dioceseId: '',
  otherDiocese: '',
  city: '',
  mejGroup: '',
  legalCapacity: '',
};
export const EMPTY_LOGISTICS: YouthLogistics = {
  presence: '',
  arrival: '',
  departure: '',
  transport: '',
  accommodation: '',
  notes: '',
};
export const DEFAULT_FAMILY_RULES: FamilyRules = {
  ageReferenceDate: '',
  minAge: null,
  maxAge: null,
  healthMode: 'PAPER',
  healthNotice:
    "Le circuit sanitaire numérique n'est pas activé. Organisez la remise confidentielle de la fiche avec l'équipe santé. N'envoyez aucune donnée médicale dans les autres rubriques.",
  templates: [],
  registrationOpen: false,
  finalDeclaration:
    "Je demande l'examen de ce dossier et atteste avoir relu les informations de ce jeune. L'envoi ne confirme pas sa participation.",
};
export const FAMILY_PAGES = [
  'Identité',
  'Contacts communs',
  'Participation',
  'Santé et adaptations',
  'Documents et autorisations',
  'Paiement simulé',
  'Relire et envoyer',
] as const;
export function newYouth(id: string, city = ''): YouthDossier {
  return {
    id,
    identity: { ...EMPTY_IDENTITY, city },
    logistics: { ...EMPTY_LOGISTICS },
    state: 'DRAFT',
    revision: 0,
    currentPage: 0,
    signatures: [],
    simulation: 'NOT_TESTED',
    paperHealth: 'TO_ORGANISE',
    correction: '',
    submittedAt: null,
    participantId: null,
  };
}
export function ageOn(dateOfBirth: string, reference: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !/^\d{4}-\d{2}-\d{2}$/.test(reference))
    return null;
  const birth = new Date(dateOfBirth + 'T12:00:00Z'),
    at = new Date(reference + 'T12:00:00Z');
  if (
    !Number.isFinite(+birth) ||
    birth.toISOString().slice(0, 10) !== dateOfBirth ||
    !Number.isFinite(+at) ||
    at.toISOString().slice(0, 10) !== reference
  )
    return null;
  return (
    at.getUTCFullYear() -
    birth.getUTCFullYear() -
    (reference.slice(5) < dateOfBirth.slice(5) ? 1 : 0)
  );
}
export function missingRequirements(
  youth: YouthDossier,
  contact: FamilyContact,
  rules: FamilyRules,
): string[] {
  const missing: string[] = [];
  const i = youth.identity;
  for (const [key, label] of Object.entries({
    firstName: 'Prénom',
    lastName: 'Nom',
    dateOfBirth: 'Date de naissance',
    sex: 'Sexe',
    mejAgeGroup: 'Tranche MEJ',
    dioceseId: 'Diocèse',
    legalCapacity: 'Lien et qualité du responsable',
  }))
    if (!i[key as keyof YouthIdentity]?.trim()) missing.push(label);
  if (i.dateOfBirth && (ageOn(i.dateOfBirth, new Date().toISOString().slice(0, 10)) ?? -1) < 0)
    missing.push('Date de naissance valide');
  if (i.legalCapacity && !['LEGAL', 'SELF_ADULT'].includes(i.legalCapacity))
    missing.push('Qualité du responsable valide');
  if (
    i.legalCapacity === 'SELF_ADULT' &&
    (ageOn(i.dateOfBirth, new Date().toISOString().slice(0, 10)) ?? -1) < 18
  )
    missing.push('Un représentant légal pour un mineur');
  if (i.sex && !['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'].includes(i.sex))
    missing.push('Sexe valide');
  if (i.mejAgeGroup && !['TA', 'ES'].includes(i.mejAgeGroup)) missing.push('Tranche MEJ valide');
  if (i.dioceseId && !['UNKNOWN', 'OTHER', ...DIOCESES.map((d) => d.id)].includes(i.dioceseId))
    missing.push('Diocèse valide');
  if (i.dioceseId === 'OTHER' && !i.otherDiocese.trim()) missing.push('Autre diocèse / pays');
  const age = ageOn(i.dateOfBirth, rules.ageReferenceDate);
  if (
    (rules.minAge !== null || rules.maxAge !== null) &&
    (age === null ||
      (rules.minAge !== null && age < rules.minAge) ||
      (rules.maxAge !== null && age > rules.maxAge))
  )
    missing.push('Âge selon les règles du rassemblement');
  for (const [key, label] of Object.entries({
    name: 'Responsable : nom',
    phone: 'Responsable : téléphone',
    emergencyName: "Contact d'urgence : nom",
    emergencyPhone: "Contact d'urgence : téléphone",
  }))
    if (!contact[key as keyof FamilyContact]?.trim()) missing.push(label);
  if (!youth.logistics.presence) missing.push('Présence au rassemblement');
  for (const t of rules.templates.filter((t) => t.enabled && t.required))
    if (
      !youth.signatures.some(
        (s) => s.templateId === t.id && s.version === t.version && !s.withdrawnAt,
      )
    )
      missing.push('Signature : ' + t.title);
  return missing;
}
