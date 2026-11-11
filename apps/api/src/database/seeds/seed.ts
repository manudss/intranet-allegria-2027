import 'dotenv/config';
import { fakerFR as faker } from '@faker-js/faker';
import type { DataSource } from 'typeorm';
import { hashPassword } from '../../app/core/auth/password.util';
import {
  AssignmentStatus,
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
  ParticipantSex,
  Role,
  Team,
  TeamParticipant,
  TeamParticipantRole,
  User,
  UserRole,
  Volunteer,
  VolunteerMission,
  VolunteerMissionStatus,
  VolunteerShift,
  VolunteerShiftAssignment,
  VolunteerShiftAssignmentStatus,
  VolunteerShiftStatus,
  VolunteerSkill,
  VolunteerSkillType,
  VolunteerTag,
  VolunteerTeam,
  VolunteerTeamMembership,
} from '../../app/core/entities';
import { insertProgramDemoDay, PROGRAM_SEED_DAYS } from '../../app/core/program/program-demo-seed';
import dataSource from '../typeorm.config';

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

const dioceses = [
  'Paris',
  'Lyon',
  'Marseille',
  'Lille',
  'Toulouse',
  'Bordeaux',
  'Nantes',
  'Rennes',
  'Grenoble',
  'Montpellier',
  'Strasbourg',
  'Rouen',
  'Dijon',
  'Clermont-Ferrand',
  'Orleans',
  'Poitiers',
  'Le Mans',
  'Reims',
  'Amiens',
  'Metz',
];

/** Point de rassemblement du rassemblement 2027 : Saint-Etienne (45deg 26' 05" N, 4deg 23' 25" E). */
const GATHERING_POINT = { latitude: 45.439695, longitude: 4.387178 } as const;

const PROJECT_START = new Date('2027-10-30T08:00:00.000Z');
const PROJECT_END = new Date('2027-11-02T23:30:00.000Z');

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
  coordinator: 'COORDINATOR',
  health: 'HEALTH',
  animator: 'ANIMATOR',
  logistics: 'LOGISTICS',
  volunteers: 'VOLUNTEERS',
  viewer: 'VIEWER',
} as const;

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrateur',
  COORDINATOR: 'Coordinateur',
  HEALTH: 'Equipe sante',
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

const computeTeamCount = (participantsCount: number): number => {
  const minTeams = Math.ceil(participantsCount / 10);
  const maxTeams = Math.floor(participantsCount / 5);
  const target = Math.ceil(participantsCount / 8);
  return Math.min(maxTeams, Math.max(minTeams, target));
};

const buildTeamSizes = (participantsCount: number, teamCount: number): number[] => {
  const sizes = splitEvenly(participantsCount, teamCount);

  for (const size of sizes) {
    if (size < 5 || size > 10) {
      throw new Error(
        `Impossible de generer des equipes 5-10 pour ${participantsCount} participants et ${teamCount} equipes`,
      );
    }
  }

  return sizes;
};

const allocateVolunteersPerGroup = (
  teamCountsPerGroup: number[],
  volunteersTotal: number,
): number[] => {
  const minTotal = teamCountsPerGroup.reduce((sum, count) => sum + count, 0);
  const maxTotal = teamCountsPerGroup.reduce((sum, count) => sum + count * 2, 0);

  if (volunteersTotal < minTotal || volunteersTotal > maxTotal) {
    throw new Error(
      `Volumetrie animateurs invalide: volunteers=${volunteersTotal}, attendu entre ${minTotal} et ${maxTotal}`,
    );
  }

  const allocated = [...teamCountsPerGroup];
  let remaining = volunteersTotal - minTotal;
  let cursor = 0;

  while (remaining > 0) {
    const index = cursor % allocated.length;
    if (allocated[index] < teamCountsPerGroup[index] * 2) {
      allocated[index] += 1;
      remaining -= 1;
    }
    cursor += 1;
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
          "program_change_logs",
          "program_sequences",
          "volunteer_applications",
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

    const participantsPerGroup = splitEvenly(profile.participants, profile.groups);
    const teamCountsPerGroup = participantsPerGroup.map((count) => computeTeamCount(count));
    const volunteersPerGroup = allocateVolunteersPerGroup(teamCountsPerGroup, profile.volunteers);

    const baseUsers: Array<Partial<User>> = [
      { email: 'admin@allegria.local', passwordHash: hashPassword('Admin#2027!'), isActive: true },
      { email: 'sante@allegria.local', passwordHash: hashPassword('Health#2027!'), isActive: true },
      {
        email: 'coordination@allegria.local',
        passwordHash: hashPassword('Coord#2027!'),
        isActive: true,
      },
    ];

    for (let i = 0; i < profile.volunteers; i += 1) {
      baseUsers.push({
        email: `animator.${i + 1}@allegria.local`,
        passwordHash: hashPassword(`Anim#${(i + 1000).toString(36)}!`),
        isActive: true,
      });
    }

    const logisticCount = Math.max(8, Math.ceil(profile.groups * 1.5));
    for (let i = 0; i < logisticCount; i += 1) {
      baseUsers.push({
        email: `logistic.${i + 1}@allegria.local`,
        passwordHash: hashPassword(`Log#${(i + 2000).toString(36)}!`),
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
    pushRole(userRoles, healthUser, ROLE_CODES.health);
    pushRole(userRoles, coordinatorUser, ROLE_CODES.coordinator);

    for (const animatorUser of animatorUsers) {
      pushRole(userRoles, animatorUser, ROLE_CODES.animator);
      if (chance(0.07)) {
        pushRole(userRoles, animatorUser, ROLE_CODES.coordinator);
      }
    }

    for (const logisticUser of logisticUsers) {
      pushRole(userRoles, logisticUser, ROLE_CODES.logistics);
      if (chance(0.22)) {
        pushRole(userRoles, logisticUser, ROLE_CODES.viewer);
      }
    }

    await userRoleRepository.save(userRoles, { chunk: 1000 });

    const groupsToCreate: Group[] = [];
    for (let i = 0; i < profile.groups; i += 1) {
      const diocese = dioceses[i % dioceses.length];
      groupsToCreate.push(
        groupRepository.create({
          name: `Rassemblement ${diocese} ${Math.floor(i / dioceses.length) + 1}`,
          diocese,
          arrivalDatetime: new Date(
            `2027-07-${(19 + (i % 2)).toString().padStart(2, '0')}T08:00:00.000Z`,
          ),
          departureDatetime: new Date(
            `2027-07-${(27 + (i % 2)).toString().padStart(2, '0')}T17:30:00.000Z`,
          ),
          notes: chance(0.2) ? 'Arrivee en bus de nuit, accueil gare requis.' : null,
        }),
      );
    }
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

    const teamCountsByGroup = new Map<number, number>();
    const volunteerTeamsByGroup = new Map<number, VolunteerTeam[]>();
    const volunteerTeamsToCreate: VolunteerTeam[] = [];
    let globalVolunteerTeamIndex = 0;
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const groupVolunteers = volunteersByGroupSaved.get(group.id) ?? [];
      const localTeamCount = Math.max(
        6,
        Math.min(12, Math.max(6, Math.ceil(groupVolunteers.length / 10))),
      );
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
        const selectedTeam = pick(groupVolunteerTeams);
        volunteerTeamMembershipsToCreate.push(
          volunteerTeamMembershipRepository.create({
            volunteer,
            volunteerTeam: selectedTeam,
            volunteerId: volunteer.id,
            volunteerTeamId: selectedTeam.id,
            startAt: toDateString(new Date('2027-07-15T00:00:00.000Z')),
            endAt: toDateString(new Date('2027-07-30T00:00:00.000Z')),
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
    let globalTeamIndex = 0;

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex];
      const localParticipants = participantsByGroupSaved.get(group.id) ?? [];
      const localVolunteers = volunteersByGroupSaved.get(group.id) ?? [];
      const teamCount = teamCountsPerGroup[groupIndex];
      const teamSizes = buildTeamSizes(localParticipants.length, teamCount);

      const primaryVolunteers = [...localVolunteers.slice(0, teamCount)];
      const secondaryVolunteers = localVolunteers.slice(teamCount);

      const localTeams: Team[] = [];
      for (let i = 0; i < teamCount; i += 1) {
        const primary = primaryVolunteers[i];
        const secondary = i < secondaryVolunteers.length ? secondaryVolunteers[i] : null;
        const maxSize = teamSizes[i];

        const team = teamRepository.create({
          name: teamNameFrom(group, i, globalTeamIndex),
          group,
          primaryAnimator: primary,
          secondaryAnimator: secondary,
          maxSize,
          hostingGroup: hostingGroupFor(globalTeamIndex),
          notes: chance(0.07) ? 'Equipe repere pour accueil familles.' : null,
        });

        teamsToCreate.push(team);
        localTeams.push(team);
        globalTeamIndex += 1;
      }

      teamsByGroup.set(group.id, localTeams);
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
      const localParticipants = faker.helpers.shuffle(participantsByGroupSaved.get(group.id) ?? []);
      const localTeams = teamsByGroupSaved.get(group.id) ?? [];
      const teamSizes = buildTeamSizes(localParticipants.length, localTeams.length);

      let cursor = 0;
      for (let teamIndex = 0; teamIndex < localTeams.length; teamIndex += 1) {
        const team = localTeams[teamIndex];
        const expectedSize = teamSizes[teamIndex];

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

    const volunteerMissionsToCreate: VolunteerMission[] = [];
    const volunteerShiftsToCreate: VolunteerShift[] = [];
    const volunteerShiftAssignmentsToCreate: VolunteerShiftAssignment[] = [];
    const missionBudgetPerGroup = splitEvenly(profile.volunteerMissions, groups.length);
    const volunteerMissionKeys = groups.flatMap((group, groupIndex) => {
      const teams = savedVolunteerTeamsByGroup.get(group.id) ?? [];
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
          accommodationType: i % 40 === 39 ? AccommodationType.COLLECTIVE : AccommodationType.FAMILY,
          maxCapacity: i % 40 === 39 ? 24 : capacity,
          maxUnder18: i % 40 === 39 ? 24 : Math.max(0, capacity - faker.number.int({ min: 0, max: 2 })),
          maxAnimators: i % 40 === 39 ? null : chance(0.6) ? faker.number.int({ min: 1, max: 2 }) : null,
          parish: chance(0.7) ? `Paroisse ${faker.person.lastName()}` : null,
          notes: chance(0.1) ? 'Animaux de compagnie presents.' : null,
          hostingGroup: hostingGroupFor(i),
          status: pick(hostFamilyStatuses),
        }),
      );
    }

    const hostFamilies = await hostFamilyRepository.save(hostFamiliesToCreate, { chunk: 1000 });

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
          arrivalDate: '2027-10-30',
          departureDate: '2027-11-02',
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
            arrivalDate: '2027-10-30',
            departureDate: '2027-11-01',
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

    console.log('Seed termine.');
    console.log(`Profil: ${profileName}`);
    console.log(`Users: ${users.length}`);
    console.log(`Roles: ${roles.length}`);
    console.log(`Groups: ${groups.length}`);
    console.log(`Volunteers: ${volunteers.length}`);
    console.log(`Participants: ${participants.length}`);
    console.log(`Teams: ${teams.length}`);
    console.log(`Team memberships: ${teamParticipantsToCreate.length}`);
    console.log(`Host families: ${hostFamilies.length}`);
    console.log(`Assignments: ${assignmentsToCreate.length}`);
    console.log(`Health records: ${participantHealthToCreate.length}`);
    console.log(
      `Unassigned participants (team): ${participants.length - teamParticipantsToCreate.length}`,
    );
    console.log('Comptes de test:');
    console.log('- admin@allegria.local / Admin#2027!');
    console.log('- sante@allegria.local / Health#2027!');
    console.log('- coordination@allegria.local / Coord#2027!');
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error('Echec du seed:', error);
  process.exitCode = 1;
});
