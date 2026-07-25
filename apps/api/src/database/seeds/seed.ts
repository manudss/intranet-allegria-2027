import 'dotenv/config';
import dataSource from '../typeorm.config';
import {
  AssignmentStatus,
  Group,
  HostFamily,
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
} from '../../app/core/entities';
import { hashPassword } from '../../app/core/auth/password.util';

type SeedProfileName = 'small' | 'medium' | 'large';

type SeedProfile = {
  groups: number;
  participants: number;
  volunteers: number;
  hostFamilies: number;
  participantAssignmentRate: number;
  participantHealthRate: number;
  participantTeamRate: number;
};

const PROFILES: Record<SeedProfileName, SeedProfile> = {
  small: {
    groups: 8,
    participants: 450,
    volunteers: 110,
    hostFamilies: 120,
    participantAssignmentRate: 0.82,
    participantHealthRate: 0.58,
    participantTeamRate: 0.9,
  },
  medium: {
    groups: 20,
    participants: 4500,
    volunteers: 850,
    hostFamilies: 950,
    participantAssignmentRate: 0.86,
    participantHealthRate: 0.64,
    participantTeamRate: 0.93,
  },
  large: {
    groups: 36,
    participants: 24000,
    volunteers: 4200,
    hostFamilies: 6200,
    participantAssignmentRate: 0.89,
    participantHealthRate: 0.68,
    participantTeamRate: 0.95,
  },
};

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed || 1;
  }

  next(): number {
    // xorshift32 deterministic PRNG.
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return (this.state % 1_000_000) / 1_000_000;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  bool(probabilityTrue = 0.5): boolean {
    return this.next() < probabilityTrue;
  }

  pick<T>(items: T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  pickNullable<T>(items: T[], probabilityNull: number): T | null {
    if (this.bool(probabilityNull)) {
      return null;
    }

    return this.pick(items);
  }

  shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }
}

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

const cities = [
  'Lyon',
  'Villeurbanne',
  'Paris',
  'Nanterre',
  'Marseille',
  'Aix-en-Provence',
  'Lille',
  'Roubaix',
  'Nantes',
  'Rennes',
  'Grenoble',
  'Bordeaux',
  'Toulouse',
  'Reims',
  'Nancy',
  'Dijon',
  'Orleans',
  'Rouen',
  'Le Mans',
  'Strasbourg',
];

const firstNames = [
  'Emma',
  'Lucas',
  'Jade',
  'Nathan',
  'Louise',
  'Gabriel',
  'Chloe',
  'Raphael',
  'Ines',
  'Arthur',
  'Camille',
  'Noah',
  'Lena',
  'Hugo',
  'Sarah',
  'Paul',
  'Manon',
  'Ethan',
  'Lea',
  'Louis',
  'Sofia',
  'Tom',
  'Nina',
  'Jules',
  'Mila',
  'Leo',
  'Rose',
  'Theo',
  'Zoé',
  'Maxime',
];

const lastNames = [
  'Martin',
  'Bernard',
  'Thomas',
  'Petit',
  'Robert',
  'Richard',
  'Durand',
  'Dubois',
  'Moreau',
  'Laurent',
  'Simon',
  'Michel',
  'Lefebvre',
  'Garcia',
  'David',
  'Bertrand',
  'Roux',
  'Vincent',
  'Fournier',
  'Morel',
  'Girard',
  'Andre',
  'Lefevre',
  'Mercier',
  'Dupont',
  'Lambert',
  'Bonnet',
  'Francois',
  'Martinez',
  'Legrand',
];

const ROLE_CODES = {
  admin: 'ADMIN',
  coordinator: 'COORDINATOR',
  health: 'HEALTH',
  animator: 'ANIMATOR',
  logistics: 'LOGISTICS',
  viewer: 'VIEWER',
} as const;

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrateur',
  COORDINATOR: 'Coordinateur',
  HEALTH: 'Equipe sante',
  ANIMATOR: 'Animateur',
  LOGISTICS: 'Logistique',
  VIEWER: 'Lecture seule',
};

const parseProfile = (): SeedProfileName => {
  const cliArg = process.argv.find((arg) => arg.startsWith('--profile='));
  const rawValue = cliArg ? cliArg.split('=')[1] : process.env.SEED_PROFILE ?? 'medium';

  if (rawValue === 'small' || rawValue === 'medium' || rawValue === 'large') {
    return rawValue;
  }

  throw new Error(`Profil invalide: ${rawValue}. Valeurs autorisees: small|medium|large`);
};

const formatDate = (year: number, month: number, day: number): string => {
  const mm = month.toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  return `${year}-${mm}-${dd}`;
};

const sexValues = [ParticipantSex.FEMALE, ParticipantSex.MALE, ParticipantSex.OTHER, ParticipantSex.UNDISCLOSED];
const assignmentStatuses = [
  AssignmentStatus.CONFIRMED,
  AssignmentStatus.PLANNED,
  AssignmentStatus.COMPLETED,
  AssignmentStatus.CANCELLED,
];

async function run(): Promise<void> {
  const profileName = parseProfile();
  const profile = PROFILES[profileName];
  const rng = new Rng(20270725 + profile.participants);

  await dataSource.initialize();

  try {
    const queryRunner = dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`
        TRUNCATE TABLE
          "user_roles",
          "participant_health",
          "participant_host_family_assignments",
          "team_participants",
          "teams",
          "participants",
          "host_families",
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
    const teamParticipantRepository = dataSource.getRepository(TeamParticipant);
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

    const baseUsers: Array<Partial<User>> = [
      {
        email: 'admin@allegria.local',
        passwordHash: hashPassword('Admin#2027!'),
        isActive: true,
      },
      {
        email: 'sante@allegria.local',
        passwordHash: hashPassword('Health#2027!'),
        isActive: true,
      },
      {
        email: 'coordination@allegria.local',
        passwordHash: hashPassword('Coord#2027!'),
        isActive: true,
      },
    ];

    const animatorUserCount = Math.floor(profile.volunteers * 0.45);
    const logisticUserCount = Math.max(8, Math.floor(profile.groups * 1.2));

    for (let i = 0; i < animatorUserCount; i += 1) {
      baseUsers.push({
        email: `animator.${i + 1}@allegria.local`,
        passwordHash: hashPassword(`Anim#${(i + 1000).toString(36)}!`),
        isActive: true,
      });
    }

    for (let i = 0; i < logisticUserCount; i += 1) {
      baseUsers.push({
        email: `logistic.${i + 1}@allegria.local`,
        passwordHash: hashPassword(`Log#${(i + 500).toString(36)}!`),
        isActive: true,
      });
    }

    const users = await userRepository.save(baseUsers.map((user) => userRepository.create(user)), { chunk: 500 });

    const [adminUser, healthUser, coordinatorUser, ...otherUsers] = users;

    const userRoles: UserRole[] = [];

    const pushRole = (user: User, code: string): void => {
      const role = roleByCode.get(code);
      if (!role) {
        return;
      }

      userRoles.push(
        userRoleRepository.create({
          user,
          role,
          userId: user.id,
          roleId: role.id,
        }),
      );
    };

    pushRole(adminUser, ROLE_CODES.admin);
    pushRole(adminUser, ROLE_CODES.coordinator);
    pushRole(adminUser, ROLE_CODES.health);
    pushRole(healthUser, ROLE_CODES.health);
    pushRole(coordinatorUser, ROLE_CODES.coordinator);

    for (let i = 0; i < otherUsers.length; i += 1) {
      const user = otherUsers[i];
      if (i < animatorUserCount) {
        pushRole(user, ROLE_CODES.animator);
        if (rng.bool(0.08)) {
          pushRole(user, ROLE_CODES.coordinator);
        }
      } else {
        pushRole(user, ROLE_CODES.logistics);
        if (rng.bool(0.25)) {
          pushRole(user, ROLE_CODES.viewer);
        }
      }
    }

    await userRoleRepository.save(userRoles, { chunk: 1000 });

    const groupsToCreate: Group[] = [];
    for (let i = 0; i < profile.groups; i += 1) {
      const diocese = dioceses[i % dioceses.length];
      groupsToCreate.push(
        groupRepository.create({
          name: `Groupe ${diocese} ${Math.floor(i / dioceses.length) + 1}`,
          diocese,
          arrivalDatetime: new Date(`2027-07-${(19 + (i % 2)).toString().padStart(2, '0')}T08:00:00.000Z`),
          departureDatetime: new Date(`2027-07-${(27 + (i % 2)).toString().padStart(2, '0')}T17:00:00.000Z`),
          notes: rng.bool(0.2) ? 'Besoin d accompagnement transport gare.' : null,
        }),
      );
    }
    const groups = await groupRepository.save(groupsToCreate, { chunk: 200 });

    const animatorUsers = otherUsers.slice(0, animatorUserCount);
    const volunteersToCreate: Volunteer[] = [];

    for (let i = 0; i < profile.volunteers; i += 1) {
      const firstName = rng.pick(firstNames);
      const lastName = rng.pick(lastNames);
      const user = i < animatorUsers.length ? animatorUsers[i] : null;
      const groupRef = groups[i % groups.length];

      volunteersToCreate.push(
        volunteerRepository.create({
          user,
          firstName,
          lastName,
          phone: `+336${rng.int(10_00_00_00, 99_99_99_99).toString().padStart(8, '0')}`,
          email: user?.email ?? `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i + 1}@example.org`,
          team: `Pole ${groupRef.diocese}`,
          isGroupLeader: i < groups.length * 2,
          notes: rng.bool(0.08) ? 'Disponible en renfort nuit.' : null,
        }),
      );
    }

    const volunteers = await volunteerRepository.save(volunteersToCreate, { chunk: 1000 });

    const participantsToCreate: Participant[] = [];
    const groupPopulation = new Map<number, number>();

    for (const group of groups) {
      groupPopulation.set(group.id, 0);
    }

    for (let i = 0; i < profile.participants; i += 1) {
      const group = groups[rng.int(0, groups.length - 1)];
      const firstName = rng.pick(firstNames);
      const lastName = rng.pick(lastNames);
      const birthYear = rng.int(2009, 2015);

      participantsToCreate.push(
        participantRepository.create({
          firstName,
          lastName,
          dateOfBirth: formatDate(birthYear, rng.int(1, 12), rng.int(1, 28)),
          sex: sexValues[rng.int(0, sexValues.length - 1)],
          emergencyContactName: `${rng.pick(firstNames)} ${lastName}`,
          emergencyContactPhone: `+337${rng.int(10_00_00_00, 99_99_99_99).toString().padStart(8, '0')}`,
          diocese: group.diocese,
          city: rng.pick(cities),
          group,
        }),
      );

      groupPopulation.set(group.id, (groupPopulation.get(group.id) ?? 0) + 1);
    }

    const participants = await participantRepository.save(participantsToCreate, { chunk: 1000 });

    const participantsByGroup = new Map<number, Participant[]>();
    for (const participant of participants) {
      const groupId = participant.group?.id;
      if (!groupId) {
        continue;
      }

      const current = participantsByGroup.get(groupId) ?? [];
      current.push(participant);
      participantsByGroup.set(groupId, current);
    }

    const volunteersByGroup = new Map<number, Volunteer[]>();
    for (let i = 0; i < volunteers.length; i += 1) {
      const group = groups[i % groups.length];
      const current = volunteersByGroup.get(group.id) ?? [];
      current.push(volunteers[i]);
      volunteersByGroup.set(group.id, current);
    }

    const teamsToCreate: Team[] = [];

    for (const group of groups) {
      const localParticipants = participantsByGroup.get(group.id) ?? [];
      const localVolunteers = volunteersByGroup.get(group.id) ?? volunteers;
      const targetSize = rng.int(7, 9);
      const teamCount = Math.max(1, Math.ceil(localParticipants.length / targetSize));

      for (let i = 0; i < teamCount; i += 1) {
        const primary = localVolunteers[i % localVolunteers.length];
        const secondary = rng.bool(0.55) ? localVolunteers[(i + 3) % localVolunteers.length] : null;
        const maxSize = rng.int(8, 10);

        teamsToCreate.push(
          teamRepository.create({
            name: `Equipe ${group.diocese} ${String(i + 1).padStart(2, '0')}`,
            group,
            primaryAnimator: primary,
            secondaryAnimator: secondary,
            maxSize,
            notes: rng.bool(0.06) ? 'Equipe pilote pour l accueil.' : null,
          }),
        );
      }
    }

    const teams = await teamRepository.save(teamsToCreate, { chunk: 1000 });

    const teamsByGroup = new Map<number, Team[]>();
    for (const team of teams) {
      const groupId = team.group?.id;
      if (!groupId) {
        continue;
      }
      const current = teamsByGroup.get(groupId) ?? [];
      current.push(team);
      teamsByGroup.set(groupId, current);
    }

    const teamParticipantsToCreate: TeamParticipant[] = [];
    const assignedParticipantIds = new Set<number>();

    for (const group of groups) {
      const localParticipants = rng.shuffle(participantsByGroup.get(group.id) ?? []);
      const localTeams = teamsByGroup.get(group.id) ?? [];
      if (localTeams.length === 0) {
        continue;
      }

      const capacities = new Map<number, number>(localTeams.map((team) => [team.id, team.maxSize]));
      let teamCursor = 0;

      for (const participant of localParticipants) {
        if (!rng.bool(profile.participantTeamRate)) {
          continue;
        }

        let guard = 0;
        while (guard < localTeams.length && (capacities.get(localTeams[teamCursor].id) ?? 0) <= 0) {
          teamCursor = (teamCursor + 1) % localTeams.length;
          guard += 1;
        }

        const team = localTeams[teamCursor];
        const remaining = capacities.get(team.id) ?? 0;
        if (remaining <= 0) {
          continue;
        }

        capacities.set(team.id, remaining - 1);
        teamCursor = (teamCursor + 1) % localTeams.length;

        teamParticipantsToCreate.push(
          teamParticipantRepository.create({
            team,
            participant,
            role: rng.bool(0.12) ? TeamParticipantRole.ASSISTANT : TeamParticipantRole.MEMBER,
            notes: rng.bool(0.05) ? 'Referent petits groupes.' : null,
          }),
        );

        assignedParticipantIds.add(participant.id);
      }
    }

    await teamParticipantRepository.save(teamParticipantsToCreate, { chunk: 1000 });

    const hostFamiliesToCreate: HostFamily[] = [];
    for (let i = 0; i < profile.hostFamilies; i += 1) {
      const lastName = rng.pick(lastNames);
      const capacity = rng.int(2, 9);
      hostFamiliesToCreate.push(
        hostFamilyRepository.create({
          familyName: `Famille ${lastName}-${i + 1}`,
          address: `${rng.int(1, 160)} rue ${rng.pick(lastNames)}`,
          postalCode: `${rng.int(10000, 95999)}`,
          city: rng.pick(cities),
          phone: rng.bool(0.96)
            ? `+334${rng.int(10_00_00_00, 99_99_99_99).toString().padStart(8, '0')}`
            : null,
          email: rng.bool(0.92) ? `famille.${lastName.toLowerCase()}.${i + 1}@example.org` : null,
          maxCapacity: capacity,
          maxUnder18: Math.max(0, capacity - rng.int(0, 2)),
          parish: rng.bool(0.68) ? `Paroisse ${rng.pick(lastNames)}` : null,
          notes: rng.bool(0.08) ? 'Animaux presents dans la maison.' : null,
        }),
      );
    }

    const hostFamilies = await hostFamilyRepository.save(hostFamiliesToCreate, { chunk: 1000 });

    const familyRemainingCapacity = new Map<number, number>(
      hostFamilies.map((family) => [family.id, family.maxCapacity]),
    );

    const assignmentsToCreate: ParticipantHostFamilyAssignment[] = [];

    for (const participant of participants) {
      if (!rng.bool(profile.participantAssignmentRate)) {
        continue;
      }

      const family = hostFamilies[rng.int(0, hostFamilies.length - 1)];
      const status = assignmentStatuses[rng.int(0, assignmentStatuses.length - 1)];
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
          arrivalDate: '2027-07-19',
          departureDate: '2027-07-27',
          status,
          notes:
            status === AssignmentStatus.CANCELLED
              ? 'Affectation annulee suite desistement famille.'
              : rng.bool(0.06)
                ? 'Besoin lit bas en raison douleur genou.'
                : null,
        }),
      );

      // Small percentage with reassignment history for edge cases.
      if (rng.bool(0.04) && status !== AssignmentStatus.CANCELLED) {
        assignmentsToCreate.push(
          assignmentRepository.create({
            participant,
            hostFamily: family,
            arrivalDate: '2027-07-19',
            departureDate: '2027-07-21',
            status: AssignmentStatus.CANCELLED,
            notes: 'Historique: reassigne apres incident logistique.',
          }),
        );
      }
    }

    await assignmentRepository.save(assignmentsToCreate, { chunk: 1000 });

    const medicalAuthors = [adminUser, healthUser];
    const participantHealthToCreate: ParticipantHealth[] = [];

    for (const participant of participants) {
      if (!rng.bool(profile.participantHealthRate)) {
        continue;
      }

      participantHealthToCreate.push(
        participantHealthRepository.create({
          participant,
          medicalConditions: rng.pickNullable(['Asthme', 'Diabete de type 1', 'Epilepsie', 'Aucune'], 0.52),
          allergies: rng.pickNullable(['Arachides', 'Pollen', 'Aucune', 'Lactose'], 0.5),
          medications: rng.pickNullable(
            ['Ventoline', 'Insuline', 'Traitement antihistaminique', 'Aucun traitement'],
            0.5,
          ),
          specialNeeds: rng.pickNullable(
            ['Suivi animateur de reference', 'Temps calme quotidien', 'Aucun besoin specifique'],
            0.62,
          ),
          dietaryNotes: rng.pickNullable(['Sans porc', 'Vegetarien', 'Aucune consigne'], 0.6),
          emergencyInstructions: rng.pickNullable(
            [
              'Appeler SAMU si detresse respiratoire.',
              'Contacter medecin traitant avant toute medicamentation.',
              'Informer immediatement les responsables sante.',
            ],
            0.55,
          ),
          lastUpdatedAt: new Date(`2027-07-${rng.int(1, 25).toString().padStart(2, '0')}T12:00:00.000Z`),
          lastUpdatedBy: medicalAuthors[rng.int(0, medicalAuthors.length - 1)],
        }),
      );
    }

    await participantHealthRepository.save(participantHealthToCreate, { chunk: 1000 });

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
    console.log(`Unassigned participants (team): ${participants.length - assignedParticipantIds.size}`);
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

