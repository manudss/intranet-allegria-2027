import type { DataSource } from 'typeorm';
import {
  GatheringGroup,
  GatheringGroupCategory,
  GatheringGroupManager,
  GatheringGroupSequence,
  GatheringGroupTeam,
  GatheringGroupVolunteerTeam,
  GatheringRepartition,
  ProgramSequence,
  ProgramSequenceTrack,
  User,
  VolunteerTeam,
} from '../../app/core/entities';

/**
 * Jeu de démonstration des groupes de rassemblement, branché sur le planning (créneaux de
 * l'agenda réellement semés) pour couvrir les cas à tester dans l'interface :
 * - répartition liée à un temps commun (repas, jeu) ou à une piste TA / ES, et autonome ;
 * - groupes TA, ES, Mixte ; vide, avec places, presque complet, complet, en dépassement ;
 * - dérogation de dépassement active ; groupe sans limite de capacité ;
 * - équipes sans piste renseignée (seulement acceptées par un groupe Mixte) ;
 * - équipes présentes dans plusieurs répartitions, dont deux créneaux qui se chevauchent
 *   (alerte de chevauchement) ;
 * - équipes bénévoles opérationnelles rattachées, responsables nommés ;
 * - équipes laissées à placer, pour essayer le dispatch manuel, le glisser-déposer et la
 *   proposition automatique.
 * Aucune donnée réelle : tout est fictif.
 */

type TeamSize = { id: number; track: ProgramSequenceTrack; persons: number };
type GroupSpec = {
  name: string;
  category: GatheringGroupCategory;
  location?: string;
  /** null = sans limite ; sinon part de la charge placée (1 = juste complet). */
  fill: number | null;
  /** Nombre d'équipes à y placer (0 = vide). */
  teams: number;
};

const TA = GatheringGroupCategory.TA;
const ES = GatheringGroupCategory.ES;
const MIXTE = GatheringGroupCategory.MIXTE;

function trackFits(category: GatheringGroupCategory, track: ProgramSequenceTrack): boolean {
  return category === MIXTE || String(category) === String(track);
}

export async function seedGatheringDemo(
  dataSource: DataSource,
  args: { adminUser: User | null; coordinator: User | null; volunteerTeams: VolunteerTeam[] },
): Promise<{ repartitions: number; groups: number; placements: number }> {
  const repartitionRepo = dataSource.getRepository(GatheringRepartition);
  const groupRepo = dataSource.getRepository(GatheringGroup);
  const linkRepo = dataSource.getRepository(GatheringGroupTeam);
  const managerRepo = dataSource.getRepository(GatheringGroupManager);
  const sequenceLinkRepo = dataSource.getRepository(GatheringGroupSequence);
  const volunteerLinkRepo = dataSource.getRepository(GatheringGroupVolunteerTeam);

  const sequences = await dataSource
    .getRepository(ProgramSequence)
    .find({ order: { eventDate: 'ASC', startTime: 'ASC' } });
  const sequence = (date: string, titlePrefix: string, track?: ProgramSequenceTrack) =>
    sequences.find(
      (s) =>
        String(s.eventDate).slice(0, 10) === date &&
        s.title.toLowerCase().startsWith(titlePrefix.toLowerCase()) &&
        (track === undefined || s.track === track),
    ) ?? null;

  const rows: { id: number; track: ProgramSequenceTrack; jeunes: string; animateurs: string }[] =
    await dataSource.query(
      `SELECT t.id, t.track,
              COUNT(tp.participant_id) AS jeunes,
              ((CASE WHEN t.primary_animator_id IS NOT NULL THEN 1 ELSE 0 END)
             + (CASE WHEN t.secondary_animator_id IS NOT NULL THEN 1 ELSE 0 END)) AS animateurs
         FROM teams t LEFT JOIN team_participants tp ON tp.team_id = t.id
        GROUP BY t.id ORDER BY t.id`,
    );
  const teams: TeamSize[] = rows.map((r) => ({
    id: r.id,
    track: r.track,
    persons: Number(r.jeunes) + Number(r.animateurs),
  }));
  const byTrack = (track: ProgramSequenceTrack) => teams.filter((t) => t.track === track);
  const taTeams = byTrack(ProgramSequenceTrack.TA);
  const esTeams = byTrack(ProgramSequenceTrack.ES);
  const noTrackTeams = byTrack(ProgramSequenceTrack.COMMON);

  let repartitionCount = 0;
  let groupCount = 0;
  let placementCount = 0;

  /** Crée une répartition, ses groupes, et place des équipes selon les spécifications. */
  async function build(
    name: string,
    notes: string,
    seq: ProgramSequence | null,
    specs: GroupSpec[],
    pool: TeamSize[],
    options: { allowOverflow?: boolean; managers?: boolean } = {},
  ): Promise<GatheringGroup[]> {
    const repartition = await repartitionRepo.save(
      repartitionRepo.create({
        name,
        notes,
        programSequenceId: seq?.id ?? null,
        allowOverflow: options.allowOverflow ?? false,
        countAnimators: true,
      }),
    );
    repartitionCount += 1;
    const created: GatheringGroup[] = [];
    const remaining = [...pool];
    for (const spec of specs) {
      const picked: TeamSize[] = [];
      for (let i = 0; i < remaining.length && picked.length < spec.teams; ) {
        if (trackFits(spec.category, remaining[i].track)) {
          picked.push(remaining[i]);
          remaining.splice(i, 1);
        } else {
          i += 1;
        }
      }
      const load = picked.reduce((sum, t) => sum + t.persons, 0);
      const group = await groupRepo.save(
        groupRepo.create({
          repartitionId: repartition.id,
          name: spec.name,
          category: spec.category,
          location: spec.location ?? null,
          capacityPersons: spec.fill === null ? null : Math.max(1, Math.round(load * spec.fill) || 20),
        }),
      );
      groupCount += 1;
      created.push(group);
      // Lien groupe <-> créneau : posé groupe par groupe (relation plusieurs-à-plusieurs).
      if (seq) {
        await sequenceLinkRepo.save(sequenceLinkRepo.create({ groupId: group.id, programSequenceId: seq.id }));
      }
      if (picked.length) {
        await linkRepo.save(
          picked.map((t) =>
            linkRepo.create({ repartitionId: repartition.id, groupId: group.id, teamId: t.id }),
          ),
          { chunk: 500 },
        );
        placementCount += picked.length;
      }
    }
    if (options.managers && created[0]) {
      const users = [args.adminUser, args.coordinator].filter((u): u is User => !!u);
      await managerRepo.save(
        users.map((u) => managerRepo.create({ groupId: created[0].id, userId: u.id })),
      );
    }
    return created;
  }

  // 1. Repas du midi J1 (temps commun) : tout le monde, six lieux, cas de remplissage variés.
  const midi = await build(
    'Repas du midi, dimanche 31/10',
    'Temps commun : les équipes mangent par lieu. Cas : complet, presque complet, places libres, vide, sans limite.',
    sequence('2027-10-31', 'Repas'),
    [
      { name: 'Réfectoire A', category: MIXTE, location: 'Réfectoire A', fill: 1, teams: 40 },
      { name: 'Réfectoire B', category: MIXTE, location: 'Réfectoire B', fill: 1.05, teams: 40 },
      { name: 'Réfectoire C', category: MIXTE, location: 'Réfectoire C', fill: 1.5, teams: 30 },
      { name: 'Salle des fêtes', category: MIXTE, location: 'Salle des fêtes', fill: 2, teams: 20 },
      { name: 'Barnum extérieur', category: MIXTE, location: 'Parvis', fill: null, teams: 25 },
      { name: 'Réserve (vide)', category: MIXTE, location: 'Cour', fill: 3, teams: 0 },
    ],
    teams,
    { managers: true },
  );

  // 2. Grand jeu dans la ville (temps commun) : groupes TA, ES et Mixte, avec équipes à placer.
  const jeu = await build(
    'Grand jeu du samedi apres-midi',
    'Exemple : trois groupes par piste pour le grand jeu. Des équipes restent à placer pour tester le dispatch.',
    sequence('2027-11-01', 'Jeu dans la ville', ProgramSequenceTrack.COMMON),
    [
      { name: 'Vikings', category: TA, location: 'Grand terrain', fill: 1.6, teams: 6 },
      { name: 'Explorateurs', category: ES, location: 'Foret', fill: 1.6, teams: 6 },
      { name: 'Pionniers', category: MIXTE, location: 'Place du village', fill: 1, teams: 4 },
      { name: 'Bâtisseurs', category: TA, location: 'Halle', fill: 3, teams: 0 },
      { name: 'Voyageurs', category: ES, location: 'Gare', fill: 3, teams: 0 },
    ],
    teams.slice(0, 80),
    { managers: true },
  );

  // 3. Messe en paroisse, par piste : deux répartitions liées aux créneaux TA et ES.
  await build(
    'Messe en paroisse (piste TA)',
    'Lié au créneau TA. Seules les équipes TA entrent dans les groupes TA ; les équipes sans piste attendent leur piste.',
    sequence('2027-11-01', 'Temps de la Parole', ProgramSequenceTrack.TA),
    [
      { name: 'Paroisse Saint-Pierre', category: TA, location: 'Saint-Pierre', fill: 1.1, teams: 30 },
      { name: 'Paroisse Notre-Dame', category: TA, location: 'Notre-Dame', fill: 1.3, teams: 30 },
      { name: 'Paroisse Saint-Jean', category: TA, location: 'Saint-Jean', fill: 1.3, teams: 20 },
    ],
    taTeams,
  );
  await build(
    'Messe en autre paroisse (piste ES)',
    'Lié au créneau ES, même heure que la piste TA.',
    sequence('2027-11-01', 'Temps de la parole', ProgramSequenceTrack.ES),
    [
      { name: 'Paroisse Sainte-Anne', category: ES, location: 'Sainte-Anne', fill: 1.2, teams: 30 },
      { name: 'Paroisse Saint-Paul', category: ES, location: 'Saint-Paul', fill: 1.2, teams: 30 },
    ],
    esTeams,
  );

  // 4. Chevauchement : même heure que le grand jeu, avec des équipes déjà dans le grand jeu
  //    (alerte de chevauchement visible sur les fiches).
  const jeuTeamIds = new Set(
    (
      await linkRepo.find({ where: { repartitionId: jeu[0].repartitionId } })
    ).map((l) => l.teamId),
  );
  const overlapPool = [
    ...teams.filter((t) => jeuTeamIds.has(t.id)).slice(0, 6),
    ...teams.filter((t) => !jeuTeamIds.has(t.id)).slice(0, 10),
  ];
  await build(
    'Ateliers découverte (chevauche le grand jeu)',
    'Cas : mêmes équipes que le grand jeu sur des horaires qui se chevauchent, pour voir l\'alerte de chevauchement.',
    sequence('2027-11-01', 'Jeu dans la ville', ProgramSequenceTrack.COMMON),
    [
      { name: 'Atelier théâtre', category: MIXTE, location: 'Salle 1', fill: 1.4, teams: 8 },
      { name: 'Atelier musique', category: MIXTE, location: 'Salle 2', fill: 1.4, teams: 8 },
    ],
    overlapPool,
  );

  // 5. Dîner J2 : dérogation de dépassement active, groupe volontairement en dépassement.
  const diner = await build(
    'Dîner du lundi 01/11 (dérogation active)',
    'Cas : la dérogation autorise le dépassement de capacité ; Réfectoire B dépasse.',
    sequence('2027-11-01', 'Dîner'),
    [
      { name: 'Réfectoire A', category: MIXTE, location: 'Réfectoire A', fill: 1.2, teams: 25 },
      { name: 'Réfectoire B', category: MIXTE, location: 'Réfectoire B', fill: 0.7, teams: 25 },
    ],
    teams.slice(100, 200),
    { allowOverflow: true },
  );

  // 6. Repas du soir autonome (sans créneau) : exemple historique de la démo.
  await build(
    'Repas du soir (par lieux)',
    'Exemple autonome : deux lieux de repas, sans evenement rattache.',
    null,
    [
      { name: 'Refectoire A', category: MIXTE, location: 'Refectoire A', fill: 1.5, teams: 6 },
      { name: 'Refectoire B', category: MIXTE, location: 'Refectoire B', fill: 1.5, teams: 6 },
      { name: 'Refectoire C', category: MIXTE, location: 'Refectoire C', fill: null, teams: 0 },
    ],
    teams.slice(200, 260),
  );

  // 7. Départs : un car par groupe, créneau du dernier jour.
  await build(
    'Départs des équipes, mercredi 03/11',
    'Lié au créneau des départs : un point de départ par groupe, équipes sans piste acceptées (groupes Mixte).',
    sequence('2027-11-03', 'Départs des équipes'),
    [
      { name: 'Départ gare', category: MIXTE, location: 'Gare', fill: 1.3, teams: 40 },
      { name: 'Départ parvis', category: MIXTE, location: 'Parvis', fill: 1.3, teams: 40 },
      { name: 'Départ TA (cars)', category: TA, location: 'Parking A', fill: 1.3, teams: 20 },
      { name: 'Départ ES (cars)', category: ES, location: 'Parking B', fill: 1.3, teams: 20 },
    ],
    [...noTrackTeams.slice(0, 80), ...taTeams.slice(40, 60), ...esTeams.slice(40, 60)],
  );

  // Liens multiples et partiels : un même groupe sur plusieurs créneaux, et un groupe de
  // répartition liée volontairement non lié à son créneau.
  const extraLinks: [GatheringGroup | undefined, ProgramSequence | null][] = [
    [midi[0], diner[0] ? sequence('2027-11-01', 'Dîner') : null],
    [midi[0], sequence('2027-11-02', 'Repas')],
    [midi[1], sequence('2027-11-02', 'Repas')],
    [jeu[2], sequence('2027-11-02', 'Grand Jeu', ProgramSequenceTrack.COMMON)],
    [jeu[0], sequence('2027-11-02', 'Grand Jeu', ProgramSequenceTrack.COMMON)],
  ];
  for (const [group, seq] of extraLinks) {
    if (!group || !seq) continue;
    const exists = await sequenceLinkRepo.findOneBy({ groupId: group.id, programSequenceId: seq.id });
    if (!exists) {
      await sequenceLinkRepo.save(sequenceLinkRepo.create({ groupId: group.id, programSequenceId: seq.id }));
    }
  }
  if (midi[5]) {
    await sequenceLinkRepo.delete({ groupId: midi[5].id });
  }

  // Équipes bénévoles opérationnelles rattachées à des groupes (cuisine, logistique...).
  const volunteerTeams = args.volunteerTeams.slice(0, 4);
  const targets = [midi[0], midi[1], jeu[0], diner[0]];
  for (let i = 0; i < Math.min(volunteerTeams.length, targets.length); i += 1) {
    await volunteerLinkRepo.save(
      volunteerLinkRepo.create({ groupId: targets[i].id, volunteerTeamId: volunteerTeams[i].id }),
    );
  }

  return { repartitions: repartitionCount, groups: groupCount, placements: placementCount };
}

