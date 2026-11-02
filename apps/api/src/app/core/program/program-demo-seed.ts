import { EntityManager } from 'typeorm';
import { ProgramSequence, ProgramSequenceStatus } from '../entities';

/**
 * Programme de démonstration des 4 jours d'ALLEGRIA 2027 (données fictives).
 * Source unique : utilisée par le seed complet, la migration qui remplit les jours vides
 * et l'action « Réinitialiser ce jour avec la démo » de la page Planning.
 */

export interface ProgramSeedItem {
  title: string;
  startTime: string;
  durationMinutes: number;
  minDurationMinutes: number;
  frozen?: boolean;
  notes?: string;
}

export const addMinutes = (time: string, minutes: number): string => {
  const total = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export const MAIN_LOCATION = 'Grande salle';

/** Un lieu parallèle : ses séquences suivent les créneaux (`slot`) de la chaîne principale du jour. */
export interface ProgramSeedBranch {
  location: string;
  items: { slot: number; title: string; durationMinutes?: number; notes?: string }[];
}

export interface ProgramSeedDay {
  eventDate: string;
  slots: ProgramSeedItem[];
  branches: ProgramSeedBranch[];
}

export const PROGRAM_SEED_DAYS: ProgramSeedDay[] = [
  {
    // J1 — arrivée et lancement
    eventDate: '2027-10-30',
    slots: [
      { title: 'Accueil & installation des groupes', startTime: '12:00', durationMinutes: 90, minDurationMinutes: 45 },
      { title: "Repas d'accueil", startTime: '13:30', durationMinutes: 60, minDurationMinutes: 45 },
      {
        title: "Messe d'ouverture",
        startTime: '14:30',
        durationMinutes: 75,
        minDurationMinutes: 60,
        frozen: true,
        notes: 'Horaire validé avec le diocèse : ne pas décaler.',
      },
      { title: 'Jeux de connaissance', startTime: '16:00', durationMinutes: 90, minDurationMinutes: 45 },
      { title: 'Goûter & temps libre', startTime: '17:30', durationMinutes: 45, minDurationMinutes: 30 },
      { title: "Topo d'ouverture : « Allegria »", startTime: '18:30', durationMinutes: 45, minDurationMinutes: 20 },
      { title: 'Dîner', startTime: '19:30', durationMinutes: 75, minDurationMinutes: 45 },
      { title: "Veillée d'ouverture", startTime: '21:00', durationMinutes: 90, minDurationMinutes: 60 },
    ],
    branches: [
      {
        location: "Hall d'accueil",
        items: [{ slot: 0, title: 'Inscriptions & remise des badges' }],
      },
      {
        location: "Cour d'honneur",
        items: [
          { slot: 0, title: 'Accueil des familles hôtes' },
          { slot: 3, title: 'Grand jeu de présentation' },
        ],
      },
      { location: 'Terrain de sport', items: [{ slot: 3, title: 'Jeux collectifs en plein air' }] },
      { location: 'Gymnase', items: [{ slot: 3, title: 'Jeux en salle (repli météo)' }] },
      { location: 'Salle Saint-Jean', items: [{ slot: 3, title: 'Découverte des équipes & des animateurs' }] },
      {
        location: 'Chapelle',
        items: [{ slot: 7, title: 'Adoration silencieuse (facultatif)', durationMinutes: 60 }],
      },
    ],
  },
  {
    // J2 — journée thématique
    eventDate: '2027-10-31',
    slots: [
      { title: 'Réveil & petit-déjeuner', startTime: '07:30', durationMinutes: 60, minDurationMinutes: 30 },
      { title: 'Louange du matin', startTime: '08:30', durationMinutes: 30, minDurationMinutes: 15 },
      { title: 'Topo du matin', startTime: '09:00', durationMinutes: 45, minDurationMinutes: 30 },
      { title: 'Ateliers thématiques (matin)', startTime: '10:00', durationMinutes: 120, minDurationMinutes: 60 },
      { title: 'Repas', startTime: '12:00', durationMinutes: 75, minDurationMinutes: 45 },
      { title: 'Grand jeu inter-groupes', startTime: '13:15', durationMinutes: 120, minDurationMinutes: 60 },
      { title: 'Ateliers thématiques (après-midi)', startTime: '15:30', durationMinutes: 90, minDurationMinutes: 45 },
      {
        title: 'Temps liturgique',
        startTime: '17:15',
        durationMinutes: 75,
        minDurationMinutes: 60,
        frozen: true,
        notes: 'Horaire validé avec le diocèse : ne pas décaler.',
      },
      { title: 'Dîner', startTime: '18:45', durationMinutes: 75, minDurationMinutes: 45 },
      { title: 'Veillée', startTime: '20:15', durationMinutes: 90, minDurationMinutes: 60 },
    ],
    branches: [
      {
        location: 'Chapelle',
        items: [
          { slot: 1, title: 'Laudes (facultatif)' },
          { slot: 3, title: 'Atelier Prière & silence' },
          { slot: 6, title: 'Temps de réconciliation' },
          { slot: 9, title: 'Adoration (facultatif)' },
        ],
      },
      {
        location: 'Salle Saint-Jean',
        items: [
          { slot: 3, title: 'Atelier Chant' },
          { slot: 6, title: 'Atelier Théâtre' },
        ],
      },
      {
        location: "Salle d'artisanat",
        items: [
          { slot: 3, title: 'Atelier Artisanat' },
          { slot: 6, title: 'Atelier Bricolage solidaire' },
        ],
      },
      {
        location: 'Salle Notre-Dame',
        items: [
          { slot: 3, title: 'Atelier Bible & partage' },
          { slot: 6, title: 'Atelier Témoignages' },
        ],
      },
      {
        location: 'Salle de musique',
        items: [
          { slot: 3, title: 'Atelier Instruments' },
          { slot: 6, title: 'Répétition de la veillée' },
        ],
      },
      {
        location: 'Gymnase',
        items: [
          { slot: 3, title: 'Atelier Sport & fair-play' },
          { slot: 5, title: 'Tournoi de balle au prisonnier' },
        ],
      },
      { location: 'Parc', items: [{ slot: 5, title: 'Parcours en forêt' }] },
      {
        location: "Cour d'honneur",
        items: [
          { slot: 5, title: 'Défis en équipe' },
          { slot: 9, title: 'Veillée autour du feu', durationMinutes: 60 },
        ],
      },
    ],
  },
  {
    // J3 — Toussaint
    eventDate: '2027-11-01',
    slots: [
      { title: 'Réveil & petit-déjeuner', startTime: '07:30', durationMinutes: 60, minDurationMinutes: 30 },
      { title: 'Topo : « Les saints parmi nous »', startTime: '08:45', durationMinutes: 45, minDurationMinutes: 30 },
      { title: 'Ateliers saints & témoins', startTime: '09:45', durationMinutes: 105, minDurationMinutes: 45 },
      {
        title: 'Messe de la Toussaint',
        startTime: '11:45',
        durationMinutes: 75,
        minDurationMinutes: 60,
        frozen: true,
        notes: 'Célébration paroissiale : horaire imposé.',
      },
      { title: 'Repas', startTime: '13:00', durationMinutes: 75, minDurationMinutes: 45 },
      { title: 'Temps libre & détente', startTime: '14:15', durationMinutes: 45, minDurationMinutes: 20 },
      { title: 'Grand jeu de piste', startTime: '15:00', durationMinutes: 150, minDurationMinutes: 90 },
      { title: 'Goûter', startTime: '17:30', durationMinutes: 30, minDurationMinutes: 20 },
      { title: 'Préparation de la soirée', startTime: '18:00', durationMinutes: 60, minDurationMinutes: 30 },
      { title: 'Dîner', startTime: '19:00', durationMinutes: 75, minDurationMinutes: 45 },
      { title: 'Soirée festive', startTime: '20:30', durationMinutes: 120, minDurationMinutes: 60 },
    ],
    branches: [
      {
        location: 'Salle Saint-Jean',
        items: [
          { slot: 2, title: 'Atelier Vie de saints' },
          { slot: 8, title: 'Préparation du spectacle' },
        ],
      },
      {
        location: "Salle d'artisanat",
        items: [
          { slot: 2, title: 'Atelier Création de vitraux' },
          { slot: 8, title: 'Décors de la soirée' },
        ],
      },
      { location: 'Salle Notre-Dame', items: [{ slot: 2, title: 'Atelier Témoignages' }] },
      {
        location: 'Salle de musique',
        items: [
          { slot: 2, title: 'Atelier Chorale' },
          { slot: 8, title: 'Répétition de la chorale' },
        ],
      },
      {
        location: 'Gymnase',
        items: [
          { slot: 2, title: 'Atelier Danse' },
          { slot: 10, title: 'Bal des saints' },
        ],
      },
      { location: 'Parc', items: [{ slot: 6, title: 'Jeu de piste : parcours nature' }] },
      { location: "Cour d'honneur", items: [{ slot: 6, title: 'Jeu de piste : parcours village' }] },
      { location: 'Terrain de sport', items: [{ slot: 6, title: 'Chasse aux saints' }] },
      {
        location: 'Chapelle',
        items: [
          { slot: 5, title: 'Temps de prière calme', durationMinutes: 45 },
          { slot: 10, title: 'Veillée de louange', durationMinutes: 60 },
        ],
      },
      { location: 'Réfectoire', items: [{ slot: 10, title: 'Buvette & crêpes' }] },
    ],
  },
  {
    // J4 — clôture et départ
    eventDate: '2027-11-02',
    slots: [
      { title: 'Réveil & petit-déjeuner', startTime: '07:30', durationMinutes: 60, minDurationMinutes: 30 },
      { title: 'Rangement des chambres', startTime: '08:30', durationMinutes: 45, minDurationMinutes: 30 },
      {
        title: 'Messe de clôture',
        startTime: '09:15',
        durationMinutes: 75,
        minDurationMinutes: 60,
        frozen: true,
        notes: 'Horaire validé avec le diocèse : ne pas décaler.',
      },
      { title: 'Temps de bilan en groupes', startTime: '10:30', durationMinutes: 75, minDurationMinutes: 45 },
      { title: 'Cérémonie de clôture', startTime: '11:45', durationMinutes: 60, minDurationMinutes: 45 },
      { title: "Repas d'au revoir", startTime: '12:45', durationMinutes: 75, minDurationMinutes: 45 },
      { title: 'Rangement & départ des groupes', startTime: '14:00', durationMinutes: 90, minDurationMinutes: 45 },
    ],
    branches: [
      { location: 'Chapelle', items: [{ slot: 1, title: 'Temps de prière personnel', durationMinutes: 45 }] },
      { location: 'Salle Saint-Jean', items: [{ slot: 3, title: 'Bilan des groupes de jeunes' }] },
      { location: 'Salle Notre-Dame', items: [{ slot: 3, title: 'Bilan des animateurs & bénévoles' }] },
      { location: "Salle d'artisanat", items: [{ slot: 3, title: 'Bilan équipes logistique' }] },
      { location: "Cour d'honneur", items: [{ slot: 6, title: 'Photo de groupe & au revoir' }] },
      { location: "Hall d'accueil", items: [{ slot: 6, title: 'Restitution des badges & départs' }] },
    ],
  },
];


/**
 * Insère le programme de démo d'un jour : chaîne principale + lieux parallèles.
 * `teamIds` sert à répartir des équipes responsables (rotation), `coordinatorId` au figement.
 */
export async function insertProgramDemoDay(
  manager: EntityManager,
  day: ProgramSeedDay,
  options: { teamIds: number[]; coordinatorId: number | null; teamCursor?: { value: number } },
): Promise<number> {
  const repository = manager.getRepository(ProgramSequence);
  const cursor = options.teamCursor ?? { value: 0 };
  const nextTeamId = () =>
    options.teamIds.length ? options.teamIds[cursor.value++ % options.teamIds.length] : null;
  let count = 0;

  const saved: ProgramSequence[] = [];
  for (const item of day.slots) {
    saved.push(
      await repository.save(
        repository.create({
          eventDate: day.eventDate,
          location: MAIN_LOCATION,
          title: item.title,
          startTime: item.startTime,
          durationMinutes: item.durationMinutes,
          endTime: addMinutes(item.startTime, item.durationMinutes),
          status: item.frozen ? ProgramSequenceStatus.FROZEN : ProgramSequenceStatus.MOBILE,
          minDurationMinutes: item.minDurationMinutes,
          previousSequenceId: saved.at(-1)?.id ?? null,
          volunteerTeamId: nextTeamId(),
          notes: item.notes ?? null,
          frozenByUserId: item.frozen ? options.coordinatorId : null,
          frozenAt: item.frozen ? new Date() : null,
        }),
      ),
    );
    count++;
  }

  for (const branch of day.branches) {
    let previousId: number | null = null;
    for (const entry of branch.items) {
      const slot = saved[entry.slot];
      const durationMinutes = entry.durationMinutes ?? slot.durationMinutes;
      const created: ProgramSequence = await repository.save(
        repository.create({
          eventDate: day.eventDate,
          location: branch.location,
          title: entry.title,
          startTime: slot.startTime,
          durationMinutes,
          endTime: addMinutes(slot.startTime, durationMinutes),
          minDurationMinutes: Math.min(15, durationMinutes),
          // Seule la tête de branche est rattachée à la chaîne principale.
          anchorSequenceId: previousId === null ? slot.id : null,
          previousSequenceId: previousId,
          volunteerTeamId: nextTeamId(),
          notes: entry.notes ?? null,
        }),
      );
      previousId = created.id;
      count++;
    }
  }
  return count;
}
