import { DEFAULT_ACCESS_RULES } from '../../app/core/access-rights/access-defaults';
import { PROPOSED_VOLUNTEER_TEAM_TYPES } from '../volunteer-team-types.data';
import { buildFamilyDemo } from './family-demo-seed';
import { registrationPdf } from '../../app/core/family-registration/registration-pdf';
import { digest } from '../../app/core/family-registration/family-registration.service';
import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { seedAccessTestkit } from './access-testkit';
import { seedGatheringDemo } from './gathering-demo-seed';
import { fakerFR as faker } from '@faker-js/faker';
import type { DataSource } from 'typeorm';
import { hashPassword } from '../../app/core/auth/password.util';
import { randomBytes } from 'crypto';
import {
  AccessBadge,
  GatheringGroup,
  GatheringGroupCategory,
  GatheringGroupManager,
  GatheringGroupTeam,
  GatheringRepartition,
  AccessBadgeAssignment,
  AccessBadgeStatus,
  AccessControlMeta,
  AccessScanDuplicateRule,
  AccessScanPoint,
  AccessScanType,
  AccessScannerGrant,
  AccessZone,
  AssignmentPersonType,
  AssignmentStatus,
  DelegationTransport,
  Group,
  HostFamily,
  AccommodationType,
  HostingGroup,
  HostingGroupKind,
  HostFamilyStatus,
  MejAgeGroup,
  Participant,
  ParticipantHealth,
  ParticipantHostFamilyAssignment,
  ParticipantRegistrationStatus,
  ParticipantSex,
  PersonNote,
  PersonSource,
  PersonType,
  ProgramSequence,
  ProgramSequenceTrack,
  Role,
  Team,
  TeamParticipant,
  TeamParticipantRole,
  TransportAssignment,
  TransportDirection,
  TransportMode,
  User,
  UserRole,
  Volunteer,
  VolunteerMission,
  VolunteerMissionStatus,
  VolunteerShift,
  VolunteerShiftAssignment,
  VolunteerShiftAssignmentStatus,
  VolunteerShiftStatus,
  VolunteerTeamLodging,
  VolunteerSkill,
  VolunteerSkillType,
  VolunteerTag,
  VolunteerTeam,
  VolunteerTeamMembership,
} from '../../app/core/entities';
import { insertProgramDemoDay, PROGRAM_SEED_DAYS } from '../../app/core/program/program-demo-seed';
import {
  CATALOGUE_DELEGATIONS,
  DELEGATIONS_VEDETTES,
  SANS_DELEGATION,
} from './delegations-catalog';
import { insertDocumentLibraryDemo } from './document-library-demo-seed';
import dataSource from '../typeorm.config';
import { computeTeamMaxSize, hasSecondaryAnimator } from './team-fill';

type SeedProfileName = 'small' | 'medium' | 'large';

type SeedProfile = {
  groups: number;
  participants: number;
  volunteers: number;
  hostFamilies: number;
  participantAssignmentRate: number;
  participantHealthRate: number;
  volunteerTeams: number;
  volunteerMissions: number;
  volunteerShiftsPerMission: number;
};

const PROFILES: Record<SeedProfileName, SeedProfile> = {
  small: {
    groups: 8,
    participants: 450,
    volunteers: 110,
    hostFamilies: 120,
    participantAssignmentRate: 0.84,
    participantHealthRate: 0.58,
    volunteerTeams: 12,
    volunteerMissions: 18,
    volunteerShiftsPerMission: 2,
  },
  medium: {
    groups: 20,
    participants: 4500,
    volunteers: 850,
    hostFamilies: 950,
    participantAssignmentRate: 0.87,
    participantHealthRate: 0.64,
    volunteerTeams: 28,
    volunteerMissions: 64,
    volunteerShiftsPerMission: 3,
  },
  large: {
    groups: 36,
    participants: 24000,
    volunteers: 4200,
    hostFamilies: 6200,
    participantAssignmentRate: 0.9,
    participantHealthRate: 0.68,
    volunteerTeams: 52,
    volunteerMissions: 160,
    volunteerShiftsPerMission: 4,
  },
};



/** Point de rassemblement du rassemblement 2027 : Saint-Etienne (45deg 26' 05" N, 4deg 23' 25" E). */
const GATHERING_POINT = { latitude: 45.439695, longitude: 4.387178 } as const;

const PROJECT_START = new Date('2027-10-31T08:00:00.000Z');
const PROJECT_END = new Date('2027-11-03T23:30:00.000Z');

/**
 * Mot de passe unique de tous les comptes crees par le seed (donnees 100 %
 * fictives, environnements de demo/preview uniquement). Documente dans
 * apps/api/src/database/seeds/README.md et affiche dans les logs de seed.
 */
const DEMO_PASSWORD = 'demo-only-not-a-secret';

/** Rayon maximal (km) autour du point de rassemblement pour les familles d'accueil. */
const HOST_FAMILY_RADIUS_KM = 100;

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111.32;

type HostTown = {
  readonly city: string;
  readonly postalCode: string;
  readonly latitude: number;
  readonly longitude: number;
};

/** Communes reelles situees a moins de 100 km de Saint-Etienne. */
const hostTowns: HostTown[] = [
  { city: 'Saint-Etienne', postalCode: '42000', latitude: 45.4397, longitude: 4.3872 },
  { city: 'Saint-Chamond', postalCode: '42400', latitude: 45.476, longitude: 4.514 },
  { city: 'Firminy', postalCode: '42700', latitude: 45.387, longitude: 4.289 },
  { city: 'Rive-de-Gier', postalCode: '42800', latitude: 45.528, longitude: 4.616 },
  { city: 'Le Chambon-Feugerolles', postalCode: '42500', latitude: 45.393, longitude: 4.319 },
  { city: 'Roche-la-Moliere', postalCode: '42230', latitude: 45.429, longitude: 4.326 },
  { city: 'La Ricamarie', postalCode: '42150', latitude: 45.416, longitude: 4.349 },
  { city: 'Unieux', postalCode: '42240', latitude: 45.403, longitude: 4.266 },
  { city: 'Villars', postalCode: '42390', latitude: 45.47, longitude: 4.362 },
  { city: 'Sorbiers', postalCode: '42290', latitude: 45.493, longitude: 4.44 },
  { city: 'Saint-Just-Saint-Rambert', postalCode: '42170', latitude: 45.495, longitude: 4.241 },
  { city: 'Andrezieux-Boutheon', postalCode: '42160', latitude: 45.529, longitude: 4.26 },
  { city: 'Montbrison', postalCode: '42600', latitude: 45.608, longitude: 4.066 },
  { city: 'Saint-Galmier', postalCode: '42330', latitude: 45.596, longitude: 4.317 },
  { city: 'Chazelles-sur-Lyon', postalCode: '42140', latitude: 45.639, longitude: 4.39 },
  { city: 'Feurs', postalCode: '42110', latitude: 45.744, longitude: 4.226 },
  { city: 'Bourg-Argental', postalCode: '42220', latitude: 45.301, longitude: 4.558 },
  { city: 'Roanne', postalCode: '42300', latitude: 46.035, longitude: 4.068 },
  { city: 'Riorges', postalCode: '42153', latitude: 46.04, longitude: 4.04 },
  { city: 'Charlieu', postalCode: '42190', latitude: 46.159, longitude: 4.174 },
  { city: 'Lyon', postalCode: '69007', latitude: 45.764, longitude: 4.8357 },
  { city: 'Villeurbanne', postalCode: '69100', latitude: 45.766, longitude: 4.88 },
  { city: 'Venissieux', postalCode: '69200', latitude: 45.697, longitude: 4.885 },
  { city: 'Oullins', postalCode: '69600', latitude: 45.714, longitude: 4.808 },
  { city: 'Givors', postalCode: '69700', latitude: 45.59, longitude: 4.769 },
  { city: 'Tarare', postalCode: '69170', latitude: 45.896, longitude: 4.434 },
  { city: "L'Arbresle", postalCode: '69210', latitude: 45.836, longitude: 4.618 },
  { city: 'Vienne', postalCode: '38200', latitude: 45.525, longitude: 4.874 },
  { city: 'Annonay', postalCode: '07100', latitude: 45.24, longitude: 4.67 },
  { city: 'Tournon-sur-Rhone', postalCode: '07300', latitude: 45.068, longitude: 4.833 },
  { city: 'Le Puy-en-Velay', postalCode: '43000', latitude: 45.043, longitude: 3.885 },
  { city: 'Yssingeaux', postalCode: '43200', latitude: 45.143, longitude: 4.123 },
  { city: 'Monistrol-sur-Loire', postalCode: '43120', latitude: 45.293, longitude: 4.173 },
  { city: 'Aurec-sur-Loire', postalCode: '43110', latitude: 45.367, longitude: 4.2 },
  { city: 'Ambert', postalCode: '63600', latitude: 45.55, longitude: 3.742 },
  { city: 'Thiers', postalCode: '63300', latitude: 45.856, longitude: 3.548 },
  { city: 'Valence', postalCode: '26000', latitude: 44.933, longitude: 4.892 },
];

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const distanceKm = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number => {
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const offsetCoordinates = (
  origin: { latitude: number; longitude: number },
  bearingRad: number,
  km: number,
): { latitude: number; longitude: number } => {
  const latitude = origin.latitude + (km / KM_PER_DEGREE_LAT) * Math.cos(bearingRad);
  const longitude =
    origin.longitude +
    (km / (KM_PER_DEGREE_LAT * Math.cos(toRadians(origin.latitude)))) * Math.sin(bearingRad);
  return { latitude, longitude };
};

const roundCoordinate = (value: number): number => Math.round(value * 1e6) / 1e6;

/**
 * Genere un point d'habitation proche d'une commune reelle, en garantissant
 * qu'il reste dans le perimetre de 100 km autour du point de rassemblement.
 */
const buildHostFamilyLocation = (): HostTown => {
  const town = pick(hostTowns);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const bearing = toRadians(faker.number.float({ min: 0, max: 360 }));
    const spreadKm = Math.sqrt(faker.number.float({ min: 0, max: 1 })) * 6;
    const point = offsetCoordinates(town, bearing, spreadKm);

    if (distanceKm(GATHERING_POINT, point) <= HOST_FAMILY_RADIUS_KM) {
      return {
        ...town,
        latitude: roundCoordinate(point.latitude),
        longitude: roundCoordinate(point.longitude),
      };
    }
  }

  return {
    ...town,
    latitude: roundCoordinate(town.latitude),
    longitude: roundCoordinate(town.longitude),
  };
};

const teamAdjectives = [
  'Aurore',
  'Sillage',
  'Kairos',
  'Orion',
  'Etincelle',
  'Horizon',
  'Azimut',
  'Atlas',
];
const teamNouns = [
  'Nomades',
  'Pionniers',
  'Sentinelles',
  'Voyageurs',
  'Boussoles',
  'Eclaireurs',
  'Convergences',
];

const sexValues = [
  ParticipantSex.FEMALE,
  ParticipantSex.MALE,
  ParticipantSex.OTHER,
  ParticipantSex.UNDISCLOSED,
];
const assignmentStatuses = [
  AssignmentStatus.CONFIRMED,
  AssignmentStatus.PENDING,
  AssignmentStatus.CONFIRMED,
  AssignmentStatus.CANCELLED,
];

const hostFamilyStatuses = [
  HostFamilyStatus.VALIDATED,
  HostFamilyStatus.VALIDATED,
  HostFamilyStatus.VALIDATED,
  HostFamilyStatus.DRAFT,
  HostFamilyStatus.INACTIVE,
];

const ROLE_CODES = {
  admin: 'ADMIN',
  scanner: 'SCANNER',
  badgeManager: 'BADGE_MANAGER',
  coordinator: 'COORDINATOR',
  health: 'HEALTH',
  catering: 'CATERING',
  animator: 'ANIMATOR',
  logistics: 'LOGISTICS',
  volunteers: 'VOLUNTEERS',
  viewer: 'VIEWER',
} as const;

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrateur',
  SCANNER: 'Scanner (controle d acces)',
  BADGE_MANAGER: 'Gestion des badges',
  COORDINATOR: 'Coordinateur',
  HEALTH: 'Equipe sante',
  CATERING: 'Restauration : besoins agrégés',
  ANIMATOR: 'Animateur',
  LOGISTICS: 'Logistique',
  VOLUNTEERS: 'Bénévoles',
  VIEWER: 'Lecture seule',
};

const operationalTeamCatalog = [
  { kind: 'Accueil', zone: 'Hall principal', shortCode: 'ACC' },
  { kind: 'Accueil', zone: 'Accueil familles', shortCode: 'FAM' },
  { kind: 'Sécurité', zone: "Contrôle d'accès", shortCode: 'SEC' },
  { kind: 'Sécurité', zone: 'Surveillance entrée', shortCode: 'ENT' },
  { kind: 'Cuisine', zone: 'Préparation repas', shortCode: 'CUS' },
  { kind: 'Cuisine', zone: 'Service restauration', shortCode: 'RES' },
  { kind: 'Animation', zone: 'Atelier jeunesse', shortCode: 'ANI' },
  { kind: 'Animation', zone: 'Maraude culturelle', shortCode: 'MAR' },
  { kind: 'Logistique', zone: 'Rangement atelier', shortCode: 'LOG' },
  { kind: 'Logistique', zone: 'Transport matériel', shortCode: 'MAT' },
  { kind: 'Santé', zone: 'Poste infirmier', shortCode: 'SAN' },
  { kind: 'Santé', zone: 'Observation médicale', shortCode: 'OBS' },
] as const;

const missionTemplatesByTeamKind: Record<
  string,
  { title: string; description: string; shiftNotes: string[] }
> = {
  Accueil: {
    title: 'Accueil et orientation des familles',
    description:
      'Accueil des participants et des familles, orientation vers les postes et suivi des arrivées.',
    shiftNotes: [
      "Accueillir les arrivées et remettre les badges d'identification.",
      "Orienter les familles vers le point d'information et la zone de repos.",
      'Gérer les attentes et préparer les dossiers de visite rapide.',
      "Contrôler la file d'accueil et expliquer les consignes du site.",
    ],
  },
  Sécurité: {
    title: "Surveillance du périmètre et contrôle d'accès",
    description:
      'Vérification des badges, vigilance aux accès et sécurisation des zones de circulation.',
    shiftNotes: [
      "Surveiller les badges à l'entrée et contrôler les accès au site.",
      "Repérer les flux de circulation et sécuriser les points d'arrêt.",
      "Faire le point sur la présence et les besoins d'assistance en poste.",
      'Signer le registre de contrôle et remonter les anomalies de sécurité.',
    ],
  },
  Cuisine: {
    title: 'Préparation et service des repas',
    description: 'Préparation des repas, service et mise en place des espaces de restauration.',
    shiftNotes: [
      'Préparer les pâtes carbonara pour le service du midi et vérifier les allergies.',
      'Mettre en place la ligne de service et préparer les portions pour les équipes.',
      'Contrôler la température des plats et organiser le recyclage des contenants.',
      'Nettoyer les zones de préparation et remettre les ustensiles au point.',
    ],
  },
  Animation: {
    title: 'Animation et atelier du public',
    description:
      'Pilotage des ateliers, animation des temps collectifs et accompagnement des groupes.',
    shiftNotes: [
      'Présenter le prochain atelier et expliquer le déroulé aux participants.',
      "Préparer le matériel d'animation en amont et accueillir les groupes.",
      "Suivre le rythme de l'atelier et ajuster l'ambiance selon les besoins.",
      'Encadrer les temps de pause et rappeler les consignes de sécurité.',
    ],
  },
  Logistique: {
    title: "Rangement et support de l'atelier",
    description: 'Gestion du matériel, rangement et appui aux équipes sur les espaces de travail.',
    shiftNotes: [
      "Ranger le matériel après l'atelier peinture et remettre les tables en ordre.",
      'Vérifier les stocks de papier, pinceaux et peintures avant la prochaine session.',
      'Aider au transport des caisses vers les espaces de stockage du site.',
      'Nettoyer les zones de travail et préparer le kit de la prochaine rotation.',
    ],
  },
  Santé: {
    title: 'Suivi médical et accompagnement des personnes',
    description: 'Support médical, évaluation rapide et écoute des besoins sanitaires du groupe.',
    shiftNotes: [
      'Vérifier la tenue des équipements de premiers secours et préparer les kits.',
      'Suivre les demandes de soins et confirmer les consignes de prise en charge.',
      'Assurer les relances de suivi avec les personnes concernées et le responsable.',
      'Renseigner le dossier santé et informer les équipes concernées.',
    ],
  },
};

const volunteerTagPool = [
  'Accueil',
  'Astreinte',
  'Bricolage',
  'Cuisine',
  'Enfance',
  'Jeunesse',
  'Logistique',
  'Maraude',
  'Médecin',
  'Restauration',
  'Santé',
  'Transport',
  'Veille',
] as const;

const parseProfile = (): SeedProfileName => {
  const cliArg = process.argv.find((arg) => arg.startsWith('--profile='));
  const rawValue = cliArg ? cliArg.split('=')[1] : (process.env.SEED_PROFILE ?? 'medium');

  if (rawValue === 'small' || rawValue === 'medium' || rawValue === 'large') {
    return rawValue;
  }

  throw new Error(`Profil invalide: ${rawValue}. Valeurs autorisees: small|medium|large`);
};

const toDateString = (date: Date): string => date.toISOString().slice(0, 10);

const dateBetween = (from: Date, to: Date): Date =>
  faker.date.between({ from: from.toISOString(), to: to.toISOString() });

const chance = (probabilityTrue: number): boolean =>
  faker.number.float({ min: 0, max: 1 }) < probabilityTrue;

const pick = <T>(items: readonly T[]): T => faker.helpers.arrayElement(items as T[]);

const participantAgeDate = (): string => {
  const birthday = faker.date.birthdate({
    mode: 'age',
    min: 12,
    max: 18,
    refDate: new Date('2027-07-20'),
  });
  return toDateString(birthday);
};

const animateurAgeDate = (): string => {
  const birthday = faker.date.birthdate({
    mode: 'age',
    min: 20,
    max: 35,
    refDate: new Date('2027-07-20'),
  });
  return toDateString(birthday);
};

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();

const splitEvenly = (total: number, parts: number): number[] => {
  const base = Math.floor(total / parts);
  const remainder = total % parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
};

// Equipes de rassemblement : cible ~6 jeunes par equipe (defaut de la page de
// repartition), avec de la marge dans maxSize pour completer les equipes en demo.
const TARGET_TEAM_SIZE = 6;
const computeTeamCount = (participantsCount: number): number =>
  participantsCount <= 0 ? 0 : Math.max(1, Math.ceil(participantsCount / TARGET_TEAM_SIZE));

// ~10 % des jeunes restent volontairement sans equipe : la page de repartition
// a ainsi des jeunes a placer en demonstration.
const UNASSIGNED_JEUNES_RATE = 0.1;
const assignableJeunesCount = (total: number): number =>
  total - Math.max(1, Math.round(total * UNASSIGNED_JEUNES_RATE));

const buildTeamSizes = (participantsCount: number, teamCount: number): number[] => {
  const sizes = splitEvenly(participantsCount, teamCount);

  for (const size of sizes) {
    if (size < 4 || size > 10) {
      throw new Error(
        `Impossible de generer des equipes 4-10 pour ${participantsCount} participants et ${teamCount} equipes`,
      );
    }
  }

  return sizes;
};

/**
 * Répartit les comptes animateurs entre les délégations : un animateur par
 * équipe d'abord (les délégations les plus dotées en équipes d'abord si les
 * comptes manquent), puis un second si les comptes disponibles le permettent.
 * Jamais plus de deux par équipe, jamais plus que les comptes créés : le
 * catalogue du lot 7 varie fortement le nombre de groupes selon le profil.
 */
const allocateVolunteersPerGroup = (
  teamCountsPerGroup: number[],
  volunteersTotal: number,
): number[] => {
  const allocated = teamCountsPerGroup.map(() => 0);
  let remaining = volunteersTotal;
  const order = teamCountsPerGroup
    .map((count, index) => ({ count, index }))
    .sort((a, b) => b.count - a.count)
    .map((x) => x.index);

  for (let round = 1; round <= 2 && remaining > 0; round += 1) {
    for (const index of order) {
      while (allocated[index] < teamCountsPerGroup[index] * round && remaining > 0) {
        allocated[index] += 1;
        remaining -= 1;
      }
      if (remaining <= 0) break;
    }
  }

  return allocated;
};

const teamNameFrom = (group: Group, groupTeamIndex: number, globalTeamIndex: number): string => {
  const dioceseCode = (group.diocese ?? 'MEJ').slice(0, 3).toUpperCase();
  const adjective = teamAdjectives[globalTeamIndex % teamAdjectives.length];
  const noun = teamNouns[groupTeamIndex % teamNouns.length];
  const serial = String(globalTeamIndex + 1).padStart(3, '0');
  return `${dioceseCode}-${adjective}-${noun}-${serial}`;
};

/** Programme des 4 jours : chaîne principale (Grande salle) + lieux parallèles rattachés aux créneaux. */
async function seedProgram(
  source: DataSource,
  users: User[],
  volunteerTeams: VolunteerTeam[],
): Promise<void> {
  const coordinator = users.find((user) => user.email === 'coordination@allegria.local');
  const teamCursor = { value: 0 };
  for (const day of PROGRAM_SEED_DAYS) {
    await insertProgramDemoDay(source.manager, day, {
      teamIds: volunteerTeams.map((team) => team.id),
      coordinatorId: coordinator?.id ?? null,
      teamCursor,
    });
  }
}

/** Données de démo du contrôle d'accès QR (plan validé le 12/11/2026). */
async function seedAccessControl(
  dataSource: DataSource,
  args: {
    adminUser: User;
    scannerUsers: User[];
    youngParticipants: Participant[];
    adultParticipants: Participant[];
  },
): Promise<{ badges: number; assignments: number }> {
  const badgeRepository = dataSource.getRepository(AccessBadge);
  const assignmentRepository = dataSource.getRepository(AccessBadgeAssignment);
  const scanTypeRepository = dataSource.getRepository(AccessScanType);
  const zoneRepository = dataSource.getRepository(AccessZone);
  const pointRepository = dataSource.getRepository(AccessScanPoint);
  const grantRepository = dataSource.getRepository(AccessScannerGrant);
  const metaRepository = dataSource.getRepository(AccessControlMeta);

  const scanTypes = await scanTypeRepository.save([
    scanTypeRepository.create({
      code: 'ENTREE',
      label: 'Entree',
      duplicateRule: AccessScanDuplicateRule.ALLOW,
    }),
    scanTypeRepository.create({
      code: 'SORTIE',
      label: 'Sortie',
      duplicateRule: AccessScanDuplicateRule.ALLOW,
    }),
    scanTypeRepository.create({
      code: 'REPAS',
      label: 'Repas',
      description: 'Un seul passage par service.',
      duplicateRule: AccessScanDuplicateRule.UNIQUE_PER_SERVICE,
    }),
    scanTypeRepository.create({
      code: 'APPEL',
      label: 'Appel du matin',
      duplicateRule: AccessScanDuplicateRule.UNIQUE_PER_DAY,
    }),
    scanTypeRepository.create({
      code: 'BUS',
      label: 'Montee bus',
      duplicateRule: AccessScanDuplicateRule.ALLOW,
    }),
  ]);
  const scanTypeByCode = new Map(scanTypes.map((scanType) => [scanType.code, scanType]));

  const zones = await zoneRepository.save([
    zoneRepository.create({ name: 'Salle pleniere', description: 'Entrees et sorties libres.' }),
    zoneRepository.create({ name: 'Restauration', description: 'Points repas.' }),
    zoneRepository.create({
      name: 'Backstage benevoles',
      description: 'Zone sensible reservee aux adultes.',
      allowedPersonTypes: [PersonType.BENEVOLE, PersonType.ANIMATEUR],
      requiresOnlineValidation: true,
      maxOfflineMinutes: 60,
    }),
  ]);
  const zoneByName = new Map(zones.map((zone) => [zone.name, zone]));

  await pointRepository.save([
    pointRepository.create({
      zoneId: zoneByName.get('Salle pleniere')!.id,
      scanTypeId: scanTypeByCode.get('ENTREE')!.id,
      name: 'Porte A',
    }),
    pointRepository.create({
      zoneId: zoneByName.get('Salle pleniere')!.id,
      scanTypeId: scanTypeByCode.get('SORTIE')!.id,
      name: 'Porte A (sortie)',
    }),
    pointRepository.create({
      zoneId: zoneByName.get('Restauration')!.id,
      scanTypeId: scanTypeByCode.get('REPAS')!.id,
      name: 'Refertoire midi',
      serviceKey: 'repas-midi',
    }),
    pointRepository.create({
      zoneId: zoneByName.get('Backstage benevoles')!.id,
      scanTypeId: scanTypeByCode.get('ENTREE')!.id,
      name: 'Sas backstage',
    }),
  ]);

  // Stock pré-imprimé de démo : un lot de 120 codes opaques.
  const lot = 'L2027-A';
  const badgesToCreate = Array.from({ length: 120 }, () =>
    badgeRepository.create({
      code: randomBytes(16).toString('hex'),
      lot,
      status: AccessBadgeStatus.AVAILABLE,
    }),
  );
  const badges = await badgeRepository.save(badgesToCreate, { chunk: 500 });

  // Badges attribués : les premiers jeunes et les fiches bénévoles adultes.
  const holders = [
    ...args.youngParticipants.slice(0, Math.min(60, args.youngParticipants.length)),
    ...args.adultParticipants.slice(0, Math.min(20, args.adultParticipants.length)),
  ];
  const assignmentsToCreate = holders.map((participant, index) =>
    assignmentRepository.create({
      badgeId: badges[index].id,
      participantId: participant.id,
      version: 1,
      metaCreatedVersion: 1,
      reason: 'Attribution initiale (seed de demo)',
      createdByUserId: args.adminUser.id,
    }),
  );
  const assignments = await assignmentRepository.save(assignmentsToCreate, { chunk: 500 });
  await badgeRepository.update(
    assignments.map((assignment) => assignment.badgeId),
    { status: AccessBadgeStatus.ASSIGNED },
  );
  await metaRepository.save(metaRepository.create({ id: 1, version: 1 }));

  // Habilitations de scan de démo : toutes zones, pendant l'événement.
  await grantRepository.save(
    args.scannerUsers.map((user) =>
      grantRepository.create({
        userId: user.id,
        zoneId: null,
        startsAt: new Date(Date.now() - 86400000),
        endsAt: new Date(Date.now() + 30 * 86400000),
        createdByUserId: args.adminUser.id,
      }),
    ),
  );

  return { badges: badges.length, assignments: assignments.length };
}

async function run(): Promise<void> {
  const profileName = parseProfile();
  const profile = PROFILES[profileName];

  faker.seed(20270725 + profile.participants);

  await dataSource.initialize();

  try {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`
        TRUNCATE TABLE
          "places_access_log",
          "place_volunteer_teams",
          "place_rooms",
          "places",
          "person_notes_split_log",
          "gathering_group_managers",
          "gathering_group_volunteer_teams",
          "gathering_group_teams",
          "gathering_group_sequences",
          "gathering_groups",
          "gathering_repartitions",
          "person_notes",
          "transport_assignments",
          "delegation_transports",
          "document_link_teams",
          "document_links",
          "document_categories",
          "registration_families",
          "registration_settings",
          "registration_challenges",
          "access_scan_events",
          "access_scan_sessions",
          "access_badge_assignments",
          "access_badges",
          "access_scan_points",
          "access_zones",
          "access_scan_types",
          "access_scanner_grants",
          "access_audit_logs",
          "access_control_meta",
          "program_change_logs",
          "program_sequences",
          "volunteer_applications",
          "volunteer_team_lodgings",
          "volunteer_audit_logs",
          "shift_status_logs",
          "mission_status_logs",
          "volunteer_shift_assignments",
          "volunteer_shifts",
          "volunteer_missions",
          "volunteer_tags",
          "volunteer_skills",
          "volunteer_team_memberships",
          "volunteer_teams",
          "volunteer_team_types",
          "access_rules",
          "access_overrides",
          "access_options",
          "user_group_scopes",
          "access_rule_logs",
          "user_roles",
          "participant_health",
          "participant_host_family_assignments",
          "team_participants",
          "teams",
          "participants",
          "host_families",
          "hosting_groups",
          "volunteers",
          "groups",
          "roles",
          "users"
        RESTART IDENTITY CASCADE
      `);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    const userRepository = dataSource.getRepository(User);
    const roleRepository = dataSource.getRepository(Role);
    const userRoleRepository = dataSource.getRepository(UserRole);
    const groupRepository = dataSource.getRepository(Group);
    const volunteerRepository = dataSource.getRepository(Volunteer);
    const participantRepository = dataSource.getRepository(Participant);
    const teamRepository = dataSource.getRepository(Team);
    const hostingGroupRepository = dataSource.getRepository(HostingGroup);
    const teamParticipantRepository = dataSource.getRepository(TeamParticipant);
    const volunteerTeamRepository = dataSource.getRepository(VolunteerTeam);
    // La matrice de droits est vidée avec le reste : on remet les droits de départ proposés.
    for (const rule of DEFAULT_ACCESS_RULES) {
      await dataSource.query(
        `INSERT INTO "access_rules" ("subject_kind", "subject_key", "module", "level", "scope") VALUES ($1, $2, $3, $4, $5)`,
        [rule.subjectKind, rule.subjectKey, rule.module, rule.level, rule.scope],
      );
    }
    // La table des types est vidée avec le reste : on remet la liste de départ (aucun rattachement).
    for (const [index, [code, label, description]] of PROPOSED_VOLUNTEER_TEAM_TYPES.entries()) {
      await dataSource.query(
        `INSERT INTO "volunteer_team_types" ("code", "label", "description", "sortOrder") VALUES ($1, $2, $3, $4)`,
        [code, label, description, (index + 1) * 10],
      );
    }
    const volunteerTeamMembershipRepository = dataSource.getRepository(VolunteerTeamMembership);
    const volunteerSkillRepository = dataSource.getRepository(VolunteerSkill);
    const volunteerTagRepository = dataSource.getRepository(VolunteerTag);
    const volunteerMissionRepository = dataSource.getRepository(VolunteerMission);
    const volunteerShiftRepository = dataSource.getRepository(VolunteerShift);
    const volunteerShiftAssignmentRepository = dataSource.getRepository(VolunteerShiftAssignment);
    const hostFamilyRepository = dataSource.getRepository(HostFamily);
    const assignmentRepository = dataSource.getRepository(ParticipantHostFamilyAssignment);
    const participantHealthRepository = dataSource.getRepository(ParticipantHealth);

    const roles = await roleRepository.save(
      Object.values(ROLE_CODES).map((code) =>
        roleRepository.create({
          code,
          label: roleLabels[code],
        }),
      ),
    );

    const { family: familyDemo, rules: familyDemoRules } = buildFamilyDemo();
    await dataSource.query('INSERT INTO registration_families(id,email,dossier) VALUES($1,$2,$3)', [
      familyDemo.id,
      familyDemo.email,
      familyDemo,
    ]);
    await dataSource.query('INSERT INTO registration_settings(id,rules) VALUES(1,$1)', [
      familyDemoRules,
    ]);

    // Existing seed pipeline only: fictional document states, never a real upload.
    const demoPiece = Buffer.from(
      await registrationPdf([
        'EXEMPLE FICTIF UNIQUEMENT',
        'Pièce administrative de démonstration, sans donnée réelle.',
      ]),
    );
    for (const [index, status] of ['RECEIVED', 'ACCEPTED', 'CORRECTION'].entries()) {
      await dataSource.query(
        'INSERT INTO registration_documents(id,family_id,"youthId",name,mime,content,digest,status,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          randomUUID(),
          familyDemo.id,
          familyDemo.youths[0].id,
          'EXEMPLE-FICTIF-' + status + '.pdf',
          'application/pdf',
          demoPiece,
          digest(demoPiece),
          status,
          index === 2 ? 'Exemple fictif : document lisible à redéposer.' : '',
        ],
      );
    }

    const roleByCode = new Map(roles.map((role) => [role.code, role]));

    const pushRole = (list: UserRole[], user: User, code: string): void => {
      const role = roleByCode.get(code);
      if (!role) {
        return;
      }

      list.push(
        userRoleRepository.create({
          user,
          role,
          userId: user.id,
          roleId: role.id,
        }),
      );
    };

    // Effectifs : la dizaine de délégations vedettes porte les effectifs de la
    // maquette, « Sans délégation » en a 9 à rattacher, les autres délégations
    // sont presque vides (0, 5, 9 ou 10 jeunes — tailles compatibles avec les
    // équipes de 4 à 10 jeunes), déterministe. Indépendant de
    // profile.participants : le catalogue décrit la démonstration cible.
    const effectifsVedettes = new Map(
      DELEGATIONS_VEDETTES.map((v) => [`Délégation de ${v.diocese}`, v.effectifCible]),
    );
    const PETITS_EFFECTIFS = [0, 5, 0, 9, 0, 0, 10, 0];
    const catalogueNames = [...CATALOGUE_DELEGATIONS.map((e) => e.name), SANS_DELEGATION.name];
    const participantsPerGroup = catalogueNames.map((name, i) => {
      if (name === SANS_DELEGATION.name) return 9;
      const cible = effectifsVedettes.get(name);
      if (cible != null) return cible;
      return PETITS_EFFECTIFS[i % PETITS_EFFECTIFS.length];
    });
    const teamCountsPerGroup = participantsPerGroup.map((count) => computeTeamCount(count));
    const volunteersPerGroup = allocateVolunteersPerGroup(teamCountsPerGroup, profile.volunteers);

    // Un seul hash calcule et reutilise : tous les comptes de demo partagent
    // DEMO_PASSWORD, et le seed reste rapide malgre le nombre de comptes.
    const demoPasswordHash = hashPassword(DEMO_PASSWORD);

    const baseUsers: Array<Partial<User>> = [
      { email: 'admin@allegria.local', passwordHash: demoPasswordHash, isActive: true },
      { email: 'sante@allegria.local', passwordHash: demoPasswordHash, isActive: true },
      { email: 'coordination@allegria.local', passwordHash: demoPasswordHash, isActive: true },
    ];

    for (let i = 0; i < profile.volunteers; i += 1) {
      baseUsers.push({
        email: `animator.${i + 1}@allegria.local`,
        passwordHash: demoPasswordHash,
        isActive: true,
      });
    }

    const logisticCount = Math.max(8, Math.ceil(profile.groups * 1.5));
    for (let i = 0; i < logisticCount; i += 1) {
      baseUsers.push({
        email: `logistic.${i + 1}@allegria.local`,
        passwordHash: demoPasswordHash,
        isActive: true,
      });
    }

    const users = await userRepository.save(
      baseUsers.map((user) => userRepository.create(user)),
      { chunk: 1000 },
    );
    const [adminUser, healthUser, coordinatorUser, ...remainingUsers] = users;
    const animatorUsers = remainingUsers.slice(0, profile.volunteers);
    const logisticUsers = remainingUsers.slice(profile.volunteers);

    const userRoles: UserRole[] = [];
    pushRole(userRoles, adminUser, ROLE_CODES.admin);
    pushRole(userRoles, adminUser, ROLE_CODES.coordinator);
    pushRole(userRoles, adminUser, ROLE_CODES.health);
    // Controle d'acces : toi et la logistique gerent les badges ; quelques
    // comptes ont le role scanner pour les demos (grants crees plus bas).
    pushRole(userRoles, adminUser, ROLE_CODES.badgeManager);
    pushRole(userRoles, adminUser, ROLE_CODES.scanner);
    // Phase de creation de l'interface : le compte demo admin peut ouvrir aussi la vue restauration (donnees fictives).
    pushRole(userRoles, adminUser, ROLE_CODES.catering);
    pushRole(userRoles, healthUser, ROLE_CODES.health);
    pushRole(userRoles, coordinatorUser, ROLE_CODES.coordinator);

    for (const animatorUser of animatorUsers) {
      pushRole(userRoles, animatorUser, ROLE_CODES.animator);
      // Chaque compte animateur est lie a une fiche benevole : le role
      // VOLUNTEERS ouvre l'acces a "Mon espace" (sinon 403 sur /api/me/*).
      pushRole(userRoles, animatorUser, ROLE_CODES.volunteers);
      if (chance(0.07)) {
        pushRole(userRoles, animatorUser, ROLE_CODES.coordinator);
      }
    }

    for (const logisticUser of logisticUsers) {
      pushRole(userRoles, logisticUser, ROLE_CODES.logistics);
      pushRole(userRoles, logisticUser, ROLE_CODES.badgeManager);
      if (chance(0.22)) {
        pushRole(userRoles, logisticUser, ROLE_CODES.viewer);
      }
    }
    // Scanners de demo : la moitie des comptes logistique et quelques animateurs.
    const scannerUsers = [
      ...logisticUsers.slice(0, Math.ceil(logisticUsers.length / 2)),
      ...animatorUsers.slice(0, 3),
    ];
    for (const scannerUser of scannerUsers) {
      pushRole(userRoles, scannerUser, ROLE_CODES.scanner);
    }

    await userRoleRepository.save(userRoles, { chunk: 1000 });

    // Lot 7 de la refonte Délégations : les délégations du seed sont le
    // catalogue complet (tous les diocèses de métropole et d'outre-mer,
    // Luxembourg, trois diocèses belges, circonscriptions institutionnelles)
    // plus « Sans délégation », au lieu d'une poignée de groupes génériques.
    const groupsToCreate: Group[] = CATALOGUE_DELEGATIONS.map((entry, i) =>
      groupRepository.create({
        name: entry.name,
        diocese: entry.diocese,
        // Aligné sur l'événement (31 oct. au 3 nov. 2027) : une délégation sur
        // deux arrive la veille au soir ou repart un jour plus tot.
        arrivalDatetime: new Date(
          i % 2 === 0 ? '2027-10-31T08:00:00.000Z' : '2027-10-30T18:00:00.000Z',
        ),
        departureDatetime: new Date(
          i % 2 === 0 ? '2027-11-03T17:30:00.000Z' : '2027-11-02T17:30:00.000Z',
        ),
        notes: null,
      }),
    );
    groupsToCreate.push(
      groupRepository.create({
        name: SANS_DELEGATION.name,
        diocese: SANS_DELEGATION.diocese,
        arrivalDatetime: new Date('2027-10-31T08:00:00.000Z'),
        departureDatetime: new Date('2027-11-03T17:30:00.000Z'),
        notes: 'Personnes non rattachées : les coordinateurs les répartissent.',
      }),
    );
    const groups = await groupRepository.save(groupsToCreate, { chunk: 200 });

    const volunteersToCreate: Volunteer[] = [];
    const volunteersByGroup = new Map<number, Volunteer[]>();

    let animatorCursor = 0;
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const groupVolunteers: Volunteer[] = [];
      const localCount = volunteersPerGroup[groupIndex];

      for (let i = 0; i < localCount; i += 1) {
        const user = animatorUsers[animatorCursor];
        animatorCursor += 1;

        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();

        const volunteer = volunteerRepository.create({
          user,
          group,
          firstName,
          lastName,
          phone: `+33${faker.string.numeric(9)}`,
          email: user.email,
          team: `Pole ${group.diocese}`,
          isGroupLeader: i === 0 || chance(0.08),
          notes: chance(0.09) ? 'Disponible en astreinte soir.' : null,
        });

        volunteersToCreate.push(volunteer);
        groupVolunteers.push(volunteer);
      }

      volunteersByGroup.set(group.id, groupVolunteers);
    }

    const volunteers = await volunteerRepository.save(volunteersToCreate, { chunk: 1000 });

    const volunteersByGroupSaved = new Map<number, Volunteer[]>();
    let volunteerSaveCursor = 0;
    for (const group of groups) {
      const expectedCount = volunteersByGroup.get(group.id)?.length ?? 0;
      volunteersByGroupSaved.set(
        group.id,
        volunteers.slice(volunteerSaveCursor, volunteerSaveCursor + expectedCount),
      );
      volunteerSaveCursor += expectedCount;
    }

    // Perimetres de groupes : les responsables de chaque delegation (chefs de
    // groupe) la voient dans leur intranet et apparaissent comme contacts pour
    // les familles (bloc trajets de l'espace famille). On ne scope pas tous
    // les benevoles : une quarantaine de contacts illisibles s'afficheraient.
    const scopeRows: { userId: number; groupId: number }[] = [];
    for (const [groupId, groupVolunteers] of volunteersByGroupSaved) {
      for (const volunteer of groupVolunteers) {
        if (volunteer.user?.id != null && volunteer.isGroupLeader) {
          scopeRows.push({ userId: volunteer.user.id, groupId });
        }
      }
    }
    for (let i = 0; i < scopeRows.length; i += 500) {
      const scopeChunk = scopeRows.slice(i, i + 500);
      const valuesSql = scopeChunk
        .map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`)
        .join(', ');
      const params = scopeChunk.flatMap((r) => [r.userId, r.groupId]);
      await dataSource.query(
        `INSERT INTO user_group_scopes (user_id, group_id) VALUES ${valuesSql} ON CONFLICT DO NOTHING`,
        params,
      );
    }

    const teamCountsByGroup = new Map<number, number>();
    const volunteerTeamsByGroup = new Map<number, VolunteerTeam[]>();
    const volunteerTeamsToCreate: VolunteerTeam[] = [];
    let globalVolunteerTeamIndex = 0;
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const groupVolunteers = volunteersByGroupSaved.get(group.id) ?? [];
      // Pas d'équipe opérationnelle pour une délégation sans bénévole.
      const localTeamCount =
        groupVolunteers.length === 0
          ? 0
          : Math.max(6, Math.min(12, Math.max(6, Math.ceil(groupVolunteers.length / 10))));
      teamCountsByGroup.set(group.id, localTeamCount);

      const localTeams: VolunteerTeam[] = [];
      for (let i = 0; i < localTeamCount; i += 1) {
        const operationalTeam = operationalTeamCatalog[i % operationalTeamCatalog.length];
        const teamCode = `${operationalTeam.shortCode}-${String(globalVolunteerTeamIndex + i + 1).padStart(3, '0')}`;
        const team = volunteerTeamRepository.create({
          name: `${operationalTeam.kind} · ${operationalTeam.zone}`,
          code: teamCode,
          description: `Equipe opérationnelle pour le périmètre ${operationalTeam.zone.toLowerCase()} sur le site du rassemblement.`,
          isActive: true,
        });
        volunteerTeamsToCreate.push(team);
        localTeams.push(team);
      }

      globalVolunteerTeamIndex += localTeamCount;
      volunteerTeamsByGroup.set(group.id, localTeams);
    }

    const savedVolunteerTeams = await volunteerTeamRepository.save(volunteerTeamsToCreate, {
      chunk: 500,
    });
    const savedVolunteerTeamsByGroup = new Map<number, VolunteerTeam[]>();
    let volunteerTeamCursor = 0;
    for (const group of groups) {
      const count = teamCountsByGroup.get(group.id) ?? 0;
      savedVolunteerTeamsByGroup.set(
        group.id,
        savedVolunteerTeams.slice(volunteerTeamCursor, volunteerTeamCursor + count),
      );
      volunteerTeamCursor += count;
    }

    const volunteerTeamMembershipsToCreate: VolunteerTeamMembership[] = [];
    const volunteerSkillsToCreate: VolunteerSkill[] = [];
    const volunteerTagsToCreate: VolunteerTag[] = [];
    const volunteerSkillPool = Object.values(VolunteerSkillType);

    for (const group of groups) {
      const groupVolunteerTeams = savedVolunteerTeamsByGroup.get(group.id) ?? [];
      const groupVolunteers = volunteersByGroupSaved.get(group.id) ?? [];
      const groupMembers = faker.helpers.shuffle(groupVolunteers);

      for (const volunteer of groupMembers) {
        // Groupe avec bénévoles mais sans équipe : pas d'affectation possible.
        if (groupVolunteerTeams.length === 0) {
          continue;
        }
        const selectedTeam = pick(groupVolunteerTeams);
        volunteerTeamMembershipsToCreate.push(
          volunteerTeamMembershipRepository.create({
            volunteer,
            volunteerTeam: selectedTeam,
            volunteerId: volunteer.id,
            volunteerTeamId: selectedTeam.id,
            startAt: toDateString(new Date('2027-10-31T00:00:00.000Z')),
            endAt: toDateString(new Date('2027-11-03T00:00:00.000Z')),
            role: pick(['Coordination', 'Support', 'Animation', 'Restauration', 'Sante']),
          }),
        );

        const skillCount = faker.number.int({ min: 2, max: 4 });
        const uniqueSkills = new Set<string>();
        while (uniqueSkills.size < skillCount) {
          uniqueSkills.add(pick(volunteerSkillPool));
        }

        for (const skill of uniqueSkills) {
          volunteerSkillsToCreate.push(
            volunteerSkillRepository.create({
              volunteer,
              volunteerId: volunteer.id,
              skill: skill as VolunteerSkillType,
            }),
          );
        }

        const tagCount = faker.number.int({ min: 1, max: 3 });
        for (let tagIndex = 0; tagIndex < tagCount; tagIndex += 1) {
          volunteerTagsToCreate.push(
            volunteerTagRepository.create({
              volunteerId: volunteer.id,
              value: String(pick(volunteerTagPool)),
            }),
          );
        }
      }
    }

    await volunteerTeamMembershipRepository.save(volunteerTeamMembershipsToCreate, { chunk: 1000 });
    await volunteerSkillRepository.save(volunteerSkillsToCreate, { chunk: 1000 });
    await volunteerTagRepository.save(volunteerTagsToCreate, { chunk: 1000 });

    const participantsToCreate: Participant[] = [];
    const participantsByGroup = new Map<number, Participant[]>();

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const count = participantsPerGroup[groupIndex];
      const localParticipants: Participant[] = [];

      for (let i = 0; i < count; i += 1) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();

        const participant = participantRepository.create({
          firstName,
          lastName,
          dateOfBirth: participantAgeDate(),
          sex: pick(sexValues),
          mejAgeGroup: pick([MejAgeGroup.TA, MejAgeGroup.ES]),
          emergencyContactName: `${faker.person.firstName()} ${lastName}`,
          emergencyContactPhone: `+33${faker.string.numeric(9)}`,
          diocese: group.diocese,
          city: faker.location.city(),
          group,
        });

        participantsToCreate.push(participant);
        localParticipants.push(participant);
      }

      participantsByGroup.set(group.id, localParticipants);
    }

    // Fiches animateurs (adultes encadrant les equipes de rassemblement) :
    // une par equipe + deux en reserve par groupe, pour alimenter l'etape 1
    // de la page de repartition. Creees APRES tous les jeunes pour preserver
    // le decoupage par tranches du tableau sauvegarde.
    const animateurCountsPerGroup = teamCountsPerGroup.map((count) =>
      count > 0 ? count + 2 : 0,
    );
    const animateursByGroup = new Map<number, Participant[]>();

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const localAnimateurs: Participant[] = [];

      for (let i = 0; i < animateurCountsPerGroup[groupIndex]; i += 1) {
        const animateur = participantRepository.create({
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          dateOfBirth: animateurAgeDate(),
          sex: pick(sexValues),
          mejAgeGroup: null,
          type: PersonType.ANIMATEUR,
          emergencyContactName: null,
          emergencyContactPhone: null,
          diocese: group.diocese,
          city: faker.location.city(),
          group,
        });

        participantsToCreate.push(animateur);
        localAnimateurs.push(animateur);
      }

      animateursByGroup.set(group.id, localAnimateurs);
    }

    const participants = await participantRepository.save(participantsToCreate, { chunk: 1000 });

    const participantsByGroupSaved = new Map<number, Participant[]>();
    let participantSaveCursor = 0;
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const count = participantsPerGroup[groupIndex];
      participantsByGroupSaved.set(
        group.id,
        participants.slice(participantSaveCursor, participantSaveCursor + count),
      );
      participantSaveCursor += count;
    }

    const animateursByGroupSaved = new Map<number, Participant[]>();
    let animateurSaveCursor = participantsPerGroup.reduce((sum, count) => sum + count, 0);
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const count = animateurCountsPerGroup[groupIndex];
      animateursByGroupSaved.set(
        group.id,
        participants.slice(animateurSaveCursor, animateurSaveCursor + count),
      );
      animateurSaveCursor += count;
    }

    // Groupes d'hébergement fictifs : quelques équipes et familles restent volontairement
    // sans groupe (1 sur 7) pour pouvoir démontrer l'affectation dans l'interface.
    const totalTeamCount = teamCountsPerGroup.reduce((sum, count) => sum + count, 0);
    const hostingGroups = await hostingGroupRepository.save(
      Array.from({ length: Math.max(3, Math.ceil(totalTeamCount / 5)) }, (_, index) =>
        hostingGroupRepository.create({
          name: `Groupe d'hébergement ${String.fromCharCode(65 + (index % 26))}${index >= 26 ? Math.floor(index / 26) : ''}`,
          notes: null,
          kind: index % 2 === 0 ? HostingGroupKind.ZONE : HostingGroupKind.PARISH,
          color: ['#2f7d6d', '#c2410c', '#1d4ed8', '#a21caf', '#b45309', '#0f766e'][index % 6],
        }),
      ),
    );
    const hostingGroupFor = (index: number): HostingGroup | null =>
      index % 7 === 6 ? null : hostingGroups[index % hostingGroups.length];

    const teamsToCreate: Team[] = [];
    const teamsByGroup = new Map<number, Team[]>();
    const teamlessVolunteersByGroup = new Map<number, Volunteer[]>();
    let globalTeamIndex = 0;

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const localParticipants = participantsByGroupSaved.get(group.id) ?? [];
      const localVolunteers = volunteersByGroupSaved.get(group.id) ?? [];
      const teamCount = teamCountsPerGroup[groupIndex];
      const teamSizes = buildTeamSizes(assignableJeunesCount(localParticipants.length), teamCount);

      const primaryVolunteers = [...localVolunteers.slice(0, teamCount)];
      const secondaryVolunteers = localVolunteers.slice(teamCount);

      // Une équipe sur cinq reste sans second animateur : ces bénévoles ne
      // sont rattachés à aucune équipe du rassemblement (démo répartition).
      let secondaryCursor = 0;

      const localTeams: Team[] = [];
      for (let i = 0; i < teamCount; i += 1) {
        const primary = primaryVolunteers[i];
        const secondary =
          hasSecondaryAnimator(globalTeamIndex) && secondaryCursor < secondaryVolunteers.length
            ? secondaryVolunteers[secondaryCursor++]
            : null;
        const maxSize = computeTeamMaxSize(teamSizes[i], secondary ? 2 : 1, globalTeamIndex);

        const team = teamRepository.create({
          name: teamNameFrom(group, i, globalTeamIndex),
          group,
          primaryAnimator: primary,
          secondaryAnimator: secondary,
          maxSize,
          hostingGroup: hostingGroupFor(globalTeamIndex),
          // Piste de demonstration : un tiers TA, un tiers ES, un tiers a renseigner.
          track:
            globalTeamIndex % 3 === 0
              ? ProgramSequenceTrack.TA
              : globalTeamIndex % 3 === 1
                ? ProgramSequenceTrack.ES
                : ProgramSequenceTrack.COMMON,
          notes: chance(0.07) ? 'Equipe repere pour accueil familles.' : null,
        });

        teamsToCreate.push(team);
        localTeams.push(team);
        globalTeamIndex += 1;
      }

      teamsByGroup.set(group.id, localTeams);
      teamlessVolunteersByGroup.set(group.id, secondaryVolunteers.slice(secondaryCursor));
    }

    const teams = await teamRepository.save(teamsToCreate, { chunk: 1000 });

    const teamsByGroupSaved = new Map<number, Team[]>();
    let teamSaveCursor = 0;
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const count = teamCountsPerGroup[groupIndex];
      teamsByGroupSaved.set(group.id, teams.slice(teamSaveCursor, teamSaveCursor + count));
      teamSaveCursor += count;
    }

    const teamParticipantsToCreate: TeamParticipant[] = [];

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const allLocalJeunes = faker.helpers.shuffle(participantsByGroupSaved.get(group.id) ?? []);
      // ~10 % des jeunes restent sans equipe (voir assignableJeunesCount).
      const localParticipants = allLocalJeunes.slice(
        0,
        assignableJeunesCount(allLocalJeunes.length),
      );
      const localAnimateurs = animateursByGroupSaved.get(group.id) ?? [];
      const localTeams = teamsByGroupSaved.get(group.id) ?? [];
      const teamSizes = buildTeamSizes(localParticipants.length, localTeams.length);

      let cursor = 0;
      for (let teamIndex = 0; teamIndex < localTeams.length; teamIndex += 1) {
        const team = localTeams[teamIndex];
        const expectedSize = teamSizes[teamIndex];

        // Un animateur referent par equipe ; les animateurs en reserve
        // (2 par groupe) restent sans equipe pour la page de repartition.
        const referent = localAnimateurs[teamIndex];
        if (referent) {
          teamParticipantsToCreate.push(
            teamParticipantRepository.create({
              team,
              participant: referent,
              role: TeamParticipantRole.MEMBER,
              notes: chance(0.15) ? 'Animateur referent d equipe.' : null,
            }),
          );
        }

        for (let i = 0; i < expectedSize; i += 1) {
          const participant = localParticipants[cursor];
          cursor += 1;

          teamParticipantsToCreate.push(
            teamParticipantRepository.create({
              team,
              participant,
              role:
                i === 0 && chance(0.2) ? TeamParticipantRole.ASSISTANT : TeamParticipantRole.MEMBER,
              notes: chance(0.04) ? 'Referent logistique equipe.' : null,
            }),
          );
        }
      }

      if (cursor !== localParticipants.length) {
        throw new Error(`Affectation equipe incomplete pour le groupe ${group.id}`);
      }
    }

    await teamParticipantRepository.save(teamParticipantsToCreate, { chunk: 1000 });

    // Adultes membres des équipes : la fiche participant (ANIMATEUR/BENEVOLE)
    // + l'appartenance team_participants sont la source unique de vérité
    // bénévole -> équipe. Les logements (plus bas) en sont la projection.
    const adultParticipantsToCreate: Participant[] = [];
    const adultTeamParticipants: TeamParticipant[] = [];
    // Appartenances a creer apres le save des fiches : avec { chunk }, save()
    // ne reinjecte pas les ids dans les instances d'entree ; il faut utiliser
    // les entites retournees (comme le bloc jeunes ci-dessus).
    const adultMembershipsPending: {
      team: Team;
      role: TeamParticipantRole;
      notes: string | null;
    }[] = [];
    const teamFreeSeats = new Map<number, number>();
    let teamlessTotal = 0;
    let benevolesPlaced = 0;

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const localTeams = teamsByGroupSaved.get(group.id) ?? [];
      const teamSizes = buildTeamSizes(
        (participantsByGroupSaved.get(group.id) ?? []).length,
        localTeams.length,
      );

      for (let teamIndex = 0; teamIndex < localTeams.length; teamIndex += 1) {
        const team = localTeams[teamIndex];
        const animators = [team.primaryAnimator, team.secondaryAnimator].filter(
          (animator): animator is Volunteer => animator != null,
        );

        for (const [animatorIndex, animator] of animators.entries()) {
          const fiche = participantRepository.create({
            firstName: animator.firstName,
            lastName: animator.lastName,
            type: PersonType.ANIMATEUR,
            dateOfBirth: toDateString(
              faker.date.between({
                from: '1968-01-01T00:00:00.000Z',
                to: '2009-06-30T00:00:00.000Z',
              }),
            ),
            sex: pick(sexValues),
            mejAgeGroup: null,
            // Reference par id : passer l'entite complete (avec son user imbrique)
            // fait tenter a TypeORM un update vide en cascade -> erreur.
            volunteer: { id: animator.id } as Volunteer,
            group: null,
            status: ParticipantRegistrationStatus.CONFIRMED,
            source: PersonSource.PUBLIC_FORM,
            emergencyContactName: null,
            emergencyContactPhone: null,
            diocese: null,
            city: null,
          });
          adultParticipantsToCreate.push(fiche);
          adultMembershipsPending.push({
            team,
            role: animatorIndex === 0 ? TeamParticipantRole.MEMBER : TeamParticipantRole.ASSISTANT,
            notes: null,
          });
        }

        teamFreeSeats.set(
          team.id,
          Math.max(0, team.maxSize - teamSizes[teamIndex] - animators.length),
        );
      }

      // Bénévoles sans rôle d'animation : ~60 % rejoignent une équipe de leur
      // groupe qui a encore de la place (fiche BENEVOLE + appartenance) ; les
      // autres restent « sans équipe » pour la démonstration de répartition.
      const teamless = teamlessVolunteersByGroup.get(group.id) ?? [];
      teamlessTotal += teamless.length;
      const benevoleCandidates = teamless.filter((_, index) => index % 5 < 3);
      let seatCursor = 0;
      for (const volunteer of benevoleCandidates) {
        for (let k = 0; k < localTeams.length; k += 1) {
          const team = localTeams[(seatCursor + k) % localTeams.length];
          const seats = teamFreeSeats.get(team.id) ?? 0;
          if (seats <= 0) {
            continue;
          }
          teamFreeSeats.set(team.id, seats - 1);
          seatCursor = (seatCursor + k + 1) % localTeams.length;
          const fiche = participantRepository.create({
            firstName: volunteer.firstName,
            lastName: volunteer.lastName,
            type: PersonType.BENEVOLE,
            dateOfBirth: null,
            sex: null,
            mejAgeGroup: null,
            volunteer: { id: volunteer.id } as Volunteer,
            group: null,
            status: ParticipantRegistrationStatus.CONFIRMED,
            source: PersonSource.STAFF,
            emergencyContactName: null,
            emergencyContactPhone: null,
            diocese: null,
            city: null,
          });
          adultParticipantsToCreate.push(fiche);
          adultMembershipsPending.push({ team, role: TeamParticipantRole.MEMBER, notes: null });
          benevolesPlaced += 1;
          break;
        }
      }
    }

    const savedAdultParticipants = await participantRepository.save(adultParticipantsToCreate, {
      chunk: 1000,
    });
    for (const [membershipIndex, membership] of adultMembershipsPending.entries()) {
      adultTeamParticipants.push(
        teamParticipantRepository.create({
          team: membership.team,
          participant: savedAdultParticipants[membershipIndex],
          role: membership.role,
          notes: membership.notes,
        }),
      );
    }
    await teamParticipantRepository.save(adultTeamParticipants, { chunk: 1000 });

    // ------------------------------------------------------------------
    // Trajets de délégation (aller/retour), affectations, exceptions et notes
    // logistiques : la preview montre tous les cas (à placer, placés, jauge,
    // exceptions reçues et sortantes, notes avec et sans réponse).
    const transportRepository = dataSource.getRepository(DelegationTransport);
    const transportAssignmentRepository = dataSource.getRepository(TransportAssignment);
    const personNoteRepository = dataSource.getRepository(PersonNote);

    const transportsToCreate: DelegationTransport[] = [];
    for (const group of groups) {
      // Pas de sous-délégation pour une délégation vide ; « Sans délégation »
      // n'a volontairement rien : ses membres restent « à rattacher ».
      const memberCount =
        (participantsByGroupSaved.get(group.id)?.length ?? 0) +
        (animateursByGroupSaved.get(group.id)?.length ?? 0) +
        (volunteersByGroupSaved.get(group.id)?.length ?? 0);
      if (memberCount === 0 || group.name === SANS_DELEGATION.name) continue;
      for (const direction of [TransportDirection.ALLER, TransportDirection.RETOUR]) {
        const outward = direction === TransportDirection.ALLER;
        const base = new Date(
          (outward ? group.arrivalDatetime : group.departureDatetime) ?? '2027-10-31T08:00:00.000Z',
        );
        const departure = new Date(base.getTime() - (outward ? 90 : 0) * 60000);
        const arrival = new Date(departure.getTime() + 150 * 60000);
        // Jauge à ~78 % de l'effectif : le car se remplit à plein (cas
        // « complet » de la maquette) et le reste attend dans l'« à placer ».
        // Petites délégations : voitures sans jauge.
        const capacity =
          memberCount < 12 ? null : Math.max(1, Math.floor(memberCount * 0.78));
        transportsToCreate.push(
          transportRepository.create({
            delegation: group,
            direction,
            transportMode: memberCount < 12 ? TransportMode.VOITURES : TransportMode.CAR,
            name: memberCount < 12 ? 'Voitures individuelles' : 'Car 1',
            departureDatetime: departure,
            arrivalDatetime: arrival,
            meetingPoint: `Gare de ${group.diocese}, parvis`,
            practicalInfo:
              'RDV 30 minutes avant le départ, colis étiqueté au nom du jeune.',
            capacity,
            notes: null,
          }),
        );
        // Grandes délégations : un second transport sans jauge (cas « sans
        // jauge » de la maquette), qui absorbe le reste de l'effectif.
        if (memberCount >= 60) {
          transportsToCreate.push(
            transportRepository.create({
              delegation: group,
              direction,
              transportMode: TransportMode.TRAIN,
              name: 'TGV spécial',
              departureDatetime: departure,
              arrivalDatetime: arrival,
              meetingPoint: `Gare de ${group.diocese}, voie 2`,
              practicalInfo: 'Billets distribués par les responsables le jour J.',
              capacity: null,
              notes: null,
            }),
          );
        }
      }
    }
    const savedTransports = await transportRepository.save(transportsToCreate, { chunk: 500 });
    const transportsByGroupDirection = new Map<string, DelegationTransport[]>();
    for (const t of savedTransports) {
      const key = `${t.delegation.id}:${t.direction}`;
      transportsByGroupDirection.set(key, [...(transportsByGroupDirection.get(key) ?? []), t]);
    }

    const transportAssignmentsToCreate: TransportAssignment[] = [];
    // Exceptions : deux jeunes de la délégation de Lyon voyagent (aller) avec
    // celle d'Annecy. Ils sont exclus de l'affectation ALLER normale de leur
    // délégation d'origine (contrainte d'unicité personne/sens ; l'exception
    // sortante sort des totaux d'origine, la reçue compte chez l'accueil).
    const exceptionOriginGroup =
      groups.find((g) => g.name === 'Délégation de Lyon') ?? null;
    const exceptionHostGroup =
      groups.find((g) => g.name === 'Délégation de Annecy') ?? null;
    const exceptionParticipantIds = new Set(
      exceptionOriginGroup
        ? (participantsByGroup.get(exceptionOriginGroup.id) ?? [])
            .slice(0, 2)
            .map((p) => p.id)
        : [],
    );
    for (const group of groups) {
      const members = [
        ...(participantsByGroup.get(group.id) ?? []).map((p) => ({
          personType: AssignmentPersonType.PARTICIPANT,
          personId: p.id,
        })),
        ...(animateursByGroupSaved.get(group.id) ?? []).map((p) => ({
          personType: AssignmentPersonType.PARTICIPANT,
          personId: p.id,
        })),
        ...(volunteersByGroupSaved.get(group.id) ?? []).map((v) => ({
          personType: AssignmentPersonType.VOLUNTEER,
          personId: v.id,
        })),
      ];
      for (const direction of [TransportDirection.ALLER, TransportDirection.RETOUR]) {
        const groupTransports = transportsByGroupDirection.get(`${group.id}:${direction}`) ?? [];
        // Remplissage dans l'ordre, sans jamais dépasser une jauge (null =
        // sans jauge, illimité) : le premier transport devient « complet » et
        // ce qui ne rentre plus reste « à placer ».
        const placesRestantes = groupTransports.map((t) =>
          t.capacity == null ? Number.POSITIVE_INFINITY : t.capacity,
        );
        let cursor = 0;
        for (const member of members) {
          if (
            direction === TransportDirection.ALLER &&
            group.id === exceptionOriginGroup?.id &&
            member.personType === AssignmentPersonType.PARTICIPANT &&
            exceptionParticipantIds.has(member.personId)
          )
            continue;
          while (cursor < groupTransports.length && placesRestantes[cursor] <= 0) cursor += 1;
          if (cursor >= groupTransports.length) break;
          placesRestantes[cursor] -= 1;
          transportAssignmentsToCreate.push(
            transportAssignmentRepository.create({
              personType: member.personType,
              personId: member.personId,
              direction,
              delegation: group,
              transport: groupTransports[cursor],
            }),
          );
        }
      }
    }
    if (exceptionOriginGroup && exceptionHostGroup) {
      // Les jeunes en exception atterrissent d'abord dans l'« à placer » de l'accueil.
      for (const p of (participantsByGroup.get(exceptionOriginGroup.id) ?? []).slice(0, 2)) {
        transportAssignmentsToCreate.push(
          transportAssignmentRepository.create({
            personType: AssignmentPersonType.PARTICIPANT,
            personId: p.id,
            direction: TransportDirection.ALLER,
            delegation: exceptionHostGroup,
            transport: null,
          }),
        );
      }
    }
    await transportAssignmentRepository.save(transportAssignmentsToCreate, { chunk: 1000 });

    // Notes logistiques sur les quatre premières délégations remplies.
    const groupesRemplis = groups.filter(
      (g) => (participantsByGroup.get(g.id)?.length ?? 0) > 0,
    );
    const notesToCreate: PersonNote[] = [];
    for (const group of groupesRemplis.slice(0, 4)) {
      const authorVolunteer = (volunteersByGroupSaved.get(group.id) ?? [])[0];
      const member = (participantsByGroup.get(group.id) ?? [])[0];
      if (!authorVolunteer || !member) continue;
      notesToCreate.push(
        personNoteRepository.create({
          personType: AssignmentPersonType.PARTICIPANT,
          personId: member.id,
          delegation: group,
          author: authorVolunteer.user,
          authorName: `${authorVolunteer.firstName} ${authorVolunteer.lastName}`,
          authorRole: 'Responsable de délégation',
          parent: null,
          body: `${member.firstName} montera au car sur le parvis de la gare, pas au point habituel.`,
        }),
      );
    }
    const savedNoteRoots = await personNoteRepository.save(notesToCreate, { chunk: 100 });
    const noteReplies: PersonNote[] = [];
    savedNoteRoots.forEach((root, index) => {
      // Une note sur deux reste sans réponse : les deux cas sont visibles.
      if (index % 2 === 1) return;
      const authorVolunteer = (volunteersByGroupSaved.get(root.delegation.id) ?? [])[0];
      noteReplies.push(
        personNoteRepository.create({
          personType: root.personType,
          personId: root.personId,
          delegation: root.delegation,
          author: authorVolunteer?.user ?? null,
          authorName: root.authorName,
          authorRole: root.authorRole,
          parent: root,
          body: 'C’est noté, le chauffeur est prévenu.',
        }),
      );
    });
    if (noteReplies.length) await personNoteRepository.save(noteReplies, { chunk: 100 });

    const volunteerMissionsToCreate: VolunteerMission[] = [];
    const volunteerShiftsToCreate: VolunteerShift[] = [];
    const volunteerShiftAssignmentsToCreate: VolunteerShiftAssignment[] = [];
    const missionBudgetPerGroup = splitEvenly(profile.volunteerMissions, groups.length);
    const volunteerMissionKeys = groups.flatMap((group, groupIndex) => {
      const teams = savedVolunteerTeamsByGroup.get(group.id) ?? [];
      const groupVolunteers = volunteersByGroupSaved.get(group.id) ?? [];
      // Groupes vides (petites délégations sans bénévole) : aucune équipe ni
      // responsable à rattacher, on ne crée pas de mission pour eux.
      if (teams.length === 0 || groupVolunteers.length === 0) {
        return [];
      }
      const missionCount = Math.max(1, missionBudgetPerGroup[groupIndex] ?? 1);
      return Array.from({ length: missionCount }, (_, missionIndex) => ({
        group,
        teams,
        missionIndex,
      }));
    });

    const resolveTeamKind = (teamName: string): string => {
      const match = teamName.match(/^([^·]+)\s*·\s*/);
      return match ? match[1].trim() : 'Mission';
    };

    const buildMissionContext = (teamName: string) => {
      const kind = resolveTeamKind(teamName);
      const template = missionTemplatesByTeamKind[kind] ?? missionTemplatesByTeamKind['Accueil'];
      const suffix = `-${String(faker.number.int({ min: 1, max: 99 })).padStart(2, '0')}`;
      return {
        title: `${template.title}${suffix}`,
        description: template.description,
        location: `${kind} · Zone ${faker.number.int({ min: 1, max: 4 })}`,
        shiftNotes: template.shiftNotes,
      };
    };

    for (const missionConfig of volunteerMissionKeys) {
      const selectedTeam = pick(missionConfig.teams);
      const responsibleVolunteerList = volunteersByGroupSaved.get(missionConfig.group.id) ?? [];
      const responsibleVolunteer = pick(responsibleVolunteerList);
      const missionContext = buildMissionContext(selectedTeam.name);
      const mission = volunteerMissionRepository.create({
        title: missionContext.title,
        description: missionContext.description,
        location: missionContext.location,
        volunteerTeam: selectedTeam,
        volunteerTeamId: selectedTeam.id,
        responsibleVolunteer,
        responsibleVolunteerId: responsibleVolunteer.id,
        status: pick([
          VolunteerMissionStatus.DRAFT,
          VolunteerMissionStatus.TODO,
          VolunteerMissionStatus.IN_PROGRESS,
          VolunteerMissionStatus.DONE,
        ]),
        isOptional: chance(0.18),
      });
      volunteerMissionsToCreate.push(mission);
    }

    const savedVolunteerMissions = await volunteerMissionRepository.save(
      volunteerMissionsToCreate,
      {
        chunk: 500,
      },
    );

    for (const mission of savedVolunteerMissions) {
      const shiftCount = Math.max(1, Math.min(profile.volunteerShiftsPerMission, 4));
      const missionKind = resolveTeamKind(mission.volunteerTeam?.name ?? 'Mission · Zone 1');
      const missionNotes =
        missionTemplatesByTeamKind[missionKind]?.shiftNotes ??
        missionTemplatesByTeamKind['Accueil'].shiftNotes;

      for (let shiftIndex = 0; shiftIndex < shiftCount; shiftIndex += 1) {
        const asUtcDay = dateBetween(PROJECT_START, PROJECT_END);
        const dayStart = new Date(asUtcDay);
        dayStart.setUTCHours(8 + (shiftIndex % 3) * 3, 0, 0, 0);
        const endAt = new Date(dayStart);
        endAt.setUTCHours(dayStart.getUTCHours() + pick([2, 3, 4, 5]));

        if (dayStart < PROJECT_START || endAt > PROJECT_END) {
          continue;
        }

        const shift = volunteerShiftRepository.create({
          mission,
          missionId: mission.id,
          startAt: dayStart,
          endAt,
          location: mission.location ?? 'Zone opérationnelle',
          capacity: pick([4, 6, 8, 10]),
          status: pick([
            VolunteerShiftStatus.TODO,
            VolunteerShiftStatus.ASSIGNED,
            VolunteerShiftStatus.IN_PROGRESS,
            VolunteerShiftStatus.DONE,
          ]),
          isOptional: chance(0.15),
          notes: missionNotes[shiftIndex % missionNotes.length],
        });
        volunteerShiftsToCreate.push(shift);
      }
    }

    const savedVolunteerShifts = await volunteerShiftRepository.save(volunteerShiftsToCreate, {
      chunk: 500,
    });

    for (const shift of savedVolunteerShifts) {
      const eligibleVolunteers = faker.helpers
        .shuffle(volunteers)
        .filter((volunteer) => volunteer.id !== null);
      const targetAssignments = Math.max(
        1,
        Math.min(shift.capacity ?? 6, faker.number.int({ min: 2, max: 6 })),
      );
      const selectedVolunteers = eligibleVolunteers.slice(0, targetAssignments);

      for (const volunteer of selectedVolunteers) {
        const assignmentStatus = pick([
          VolunteerShiftAssignmentStatus.PROVISIONAL,
          VolunteerShiftAssignmentStatus.CONFIRMED,
          VolunteerShiftAssignmentStatus.CANCELLED,
        ]);
        volunteerShiftAssignmentsToCreate.push(
          volunteerShiftAssignmentRepository.create({
            volunteer,
            volunteerId: volunteer.id,
            shift,
            shiftId: shift.id,
            status: assignmentStatus,
            assignedByUserId: pick(users).id,
            notes:
              assignmentStatus === VolunteerShiftAssignmentStatus.CANCELLED
                ? 'Annulation planifiée par coordination.'
                : chance(0.4)
                  ? 'Affectation couverte par la tournée de terrain.'
                  : null,
          }),
        );
      }
    }

    await volunteerShiftAssignmentRepository.save(volunteerShiftAssignmentsToCreate, {
      chunk: 1000,
    });

    const hostFamiliesToCreate: HostFamily[] = [];
    for (let i = 0; i < profile.hostFamilies; i += 1) {
      const familyLastName = faker.person.lastName();
      const capacity = faker.number.int({ min: 2, max: 9 });
      const location = buildHostFamilyLocation();

      hostFamiliesToCreate.push(
        hostFamilyRepository.create({
          familyName: `Famille ${familyLastName}`,
          address: faker.location.streetAddress(),
          postalCode: location.postalCode,
          city: location.city,
          latitude: location.latitude,
          longitude: location.longitude,
          phone: chance(0.95) ? `+33${faker.string.numeric(9)}` : null,
          email: chance(0.9)
            ? `famille.${normalizeText(familyLastName)}.${i + 1}@example.org`
            : null,
          accommodationType:
            i % 40 === 39 ? AccommodationType.COLLECTIVE : AccommodationType.FAMILY,
          maxCapacity: i % 40 === 39 ? 24 : capacity,
          maxUnder18:
            i % 40 === 39 ? 24 : Math.max(0, capacity - faker.number.int({ min: 0, max: 2 })),
          maxAnimators:
            i % 40 === 39 ? null : chance(0.6) ? faker.number.int({ min: 1, max: 2 }) : null,
          parish: chance(0.7) ? `Paroisse ${faker.person.lastName()}` : null,
          notes: chance(0.1) ? 'Animaux de compagnie presents.' : null,
          hostingGroup: hostingGroupFor(i),
          status: pick(hostFamilyStatuses),
        }),
      );
    }

    const hostFamilies = await hostFamilyRepository.save(hostFamiliesToCreate, { chunk: 1000 });

    // Logement des bénévoles : projection synchronisée de l'appartenance
    // team_participants (source unique) — chaque adulte membre d'une équipe
    // dort avec elle. Les bénévoles sans équipe n'ont pas de logement seedé.
    const volunteerLodgingRepository = dataSource.getRepository(VolunteerTeamLodging);
    const volunteerLodgingsToCreate: VolunteerTeamLodging[] = [];
    for (const membership of adultTeamParticipants) {
      const volunteer = membership.participant.volunteer;
      if (!volunteer) {
        continue;
      }
      volunteerLodgingsToCreate.push(
        volunteerLodgingRepository.create({
          volunteer,
          volunteerId: volunteer.id,
          team: membership.team,
          teamId: membership.team.id,
          room: chance(0.4)
            ? `Dortoir ${faker.string.alpha({ length: 1, casing: 'upper' })}`
            : null,
          notes: chance(0.15) ? 'Arrivée possible dès le jeudi soir.' : null,
          startAt: '2027-10-31',
          endAt: '2027-11-03',
        }),
      );
    }
    await volunteerLodgingRepository.save(volunteerLodgingsToCreate, { chunk: 1000 });

    const familyRemainingCapacity = new Map<number, number>(
      hostFamilies.map((family) => [family.id, family.maxCapacity]),
    );

    const hostingGroupOfTeam = new Map<number, number | null>(
      teams.map((team) => [team.id, team.hostingGroup?.id ?? null]),
    );
    const hostingGroupOfParticipant = new Map<number, number | null>(
      teamParticipantsToCreate.map((tp) => [
        tp.participant.id,
        hostingGroupOfTeam.get(tp.team.id) ?? null,
      ]),
    );
    const familiesByHostingGroup = new Map<number, HostFamily[]>();
    for (const family of hostFamilies) {
      const hostingGroupId = family.hostingGroup?.id;
      if (hostingGroupId) {
        familiesByHostingGroup.set(hostingGroupId, [
          ...(familiesByHostingGroup.get(hostingGroupId) ?? []),
          family,
        ]);
      }
    }

    const assignmentsToCreate: ParticipantHostFamilyAssignment[] = [];
    for (const participant of participants) {
      if (!chance(profile.participantAssignmentRate)) {
        continue;
      }

      // Les affectations fictives restent cohérentes : famille du groupe d'hébergement de l'équipe.
      const candidateFamilies = familiesByHostingGroup.get(
        hostingGroupOfParticipant.get(participant.id) ?? -1,
      );
      if (!candidateFamilies?.length) {
        continue;
      }
      const family = pick(candidateFamilies);
      const status = pick(assignmentStatuses);
      const remaining = familyRemainingCapacity.get(family.id) ?? 0;

      if (status !== AssignmentStatus.CANCELLED && remaining <= 0) {
        continue;
      }

      if (status !== AssignmentStatus.CANCELLED) {
        familyRemainingCapacity.set(family.id, remaining - 1);
      }

      assignmentsToCreate.push(
        assignmentRepository.create({
          participant,
          hostFamily: family,
          arrivalDate: '2027-10-31',
          departureDate: '2027-11-03',
          status,
          type: participant.type,
          notes:
            status === AssignmentStatus.CANCELLED
              ? 'Affectation annulee suite desistement famille.'
              : chance(0.06)
                ? 'Prefere dortoir calme.'
                : null,
        }),
      );

      if (status !== AssignmentStatus.CANCELLED && chance(0.04)) {
        assignmentsToCreate.push(
          assignmentRepository.create({
            participant,
            hostFamily: family,
            arrivalDate: '2027-10-31',
            departureDate: '2027-11-02',
            status: AssignmentStatus.CANCELLED,
            type: participant.type,
            notes: 'Historique: reaffecte apres ajustement transport.',
          }),
        );
      }
    }

    await assignmentRepository.save(assignmentsToCreate, { chunk: 1000 });

    const medicalAuthors = [adminUser, healthUser];
    const participantHealthToCreate: ParticipantHealth[] = [];
    for (const participant of participants) {
      if (!chance(profile.participantHealthRate)) {
        continue;
      }

      participantHealthToCreate.push(
        participantHealthRepository.create({
          participant,
          medicalConditions: chance(0.5)
            ? pick(['Asthme', 'Diabete type 1', 'Epilepsie', 'Aucune'])
            : null,
          allergies: chance(0.5) ? pick(['Arachides', 'Pollen', 'Lactose', 'Aucune']) : null,
          medications: chance(0.5)
            ? pick(['Ventoline', 'Insuline', 'Antihistaminique', 'Aucun traitement'])
            : null,
          specialNeeds: chance(0.4)
            ? pick(['Suivi animateur referent', 'Temps calme quotidien', 'Aucun besoin specifique'])
            : null,
          dietaryNotes: chance(0.4) ? pick(['Sans porc', 'Vegetarien', 'Sans lactose']) : null,
          emergencyInstructions: chance(0.45)
            ? pick([
                'Appeler le SAMU si detresse respiratoire.',
                'Contacter les responsables sante en priorite.',
                'Suivre la fiche d urgence remise au groupe.',
              ])
            : null,
          lastUpdatedAt: faker.date.between({
            from: '2027-07-01T00:00:00.000Z',
            to: '2027-07-25T23:59:59.000Z',
          }),
          lastUpdatedBy: pick(medicalAuthors),
        }),
      );
    }

    await participantHealthRepository.save(participantHealthToCreate, { chunk: 1000 });

    await seedProgram(dataSource, users, savedVolunteerTeams);

    // Groupes de rassemblement : apres le programme, pour pouvoir lier les repartitions aux
    // creneaux reels de l'agenda (avant, firstCommonSequence valait null).
    const gatheringDemo = await seedGatheringDemo(dataSource, {
      adminUser,
      coordinator: users.find((user) => user.email === 'coordination@allegria.local') ?? null,
      volunteerTeams: savedVolunteerTeams,
      demoPasswordHash,
    });
    console.log(
      `Groupes de rassemblement: ${gatheringDemo.repartitions} repartitions, ${gatheringDemo.groups} groupes, ${gatheringDemo.placements} equipes placees`,
    );

    const accessControlSeed = await seedAccessControl(dataSource, {
      adminUser,
      scannerUsers,
      youngParticipants: participants,
      adultParticipants: savedAdultParticipants,
    });

    await seedAccessTestkit(dataSource, adminUser, demoPasswordHash);

    const documentLibrary = await insertDocumentLibraryDemo(dataSource);

    console.log('Seed termine.');
    console.log(`Profil: ${profileName}`);
    console.log(`Users: ${users.length}`);
    console.log(`Roles: ${roles.length}`);
    console.log(`Groups: ${groups.length}`);
    console.log(
      `Volunteers: ${volunteers.length} (sans équipe au rassemblement: ${teamlessTotal - benevolesPlaced})`,
    );
    console.log(
      `Participants: ${participants.length} jeunes + ${adultParticipantsToCreate.length} adultes`,
    );
    console.log(
      `Teams: ${teams.length} (1/5 pleines, 1/5 à moitié, le reste avec 2-4 places libres)`,
    );
    console.log(
      `Team memberships: ${teamParticipantsToCreate.length} jeunes + ${adultTeamParticipants.length} adultes`,
    );
    console.log(`Host families: ${hostFamilies.length}`);
    console.log(`Assignments: ${assignmentsToCreate.length}`);
    console.log(`Health records: ${participantHealthToCreate.length}`);
    console.log(
      `Document library: ${documentLibrary.linksCreated} fiches inserees, ${documentLibrary.linksSkipped} conservees, ${documentLibrary.linksOmittedMissingTeam.length} omises (equipe introuvable), ${documentLibrary.categoriesCreated} categories creees`,
    );
    console.log(
      `Access control: ${accessControlSeed.badges} badges (lot L2027-A), ${accessControlSeed.assignments} attributions`,
    );
    console.log(
      `Unassigned participants (team): ${participants.length - teamParticipantsToCreate.length}`,
    );
    console.log(`Mot de passe commun des comptes de demo: ${DEMO_PASSWORD}`);
    console.log('Comptes de demo utilisables (tous avec ce mot de passe):');
    console.log('- admin@allegria.local (ADMIN)');
    console.log('- sante@allegria.local (sante)');
    console.log('- groupes.sans-agenda@allegria.local, groupes.responsable@allegria.local (groupes de rassemblement sans droit agenda ; le second limite a ses groupes)');
    console.log('- coordination@allegria.local (coordination)');
    console.log(
      '- animator.1@allegria.local, animator.2@allegria.local, ... (benevoles lies a leur fiche, acces Mon espace)',
    );
    console.log(
      '- logistic.1@allegria.local, logistic.2@allegria.local, ... (logistique, gestion badges; les premiers ont aussi le role scanner)',
    );
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error('Echec du seed:', error);
  process.exitCode = 1;
});
