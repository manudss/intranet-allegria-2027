import { EntityManager } from 'typeorm';
import { ProgramSequence, ProgramSequenceStatus } from '../entities';

/**
 * Programme des 4 jours d'ALLEGRIA 2027 (dim. 31 oct. - mer. 3 nov.), d'après le premier planning projeté
 * (thèmes, matin / après-midi / soirée, groupes TA / ES / ensemble). Les horaires et les créneaux marqués
 * `proposed` (repas, trajets, temps libres) sont proposés, pas issus du planning.
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
  /** Créneau ajouté par nous entre ceux du planning projeté (repas, trajets...). */
  proposed?: boolean;
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
  /** Thème du jour tel qu'il figure sur le planning projeté. */
  theme?: string;
  slots: ProgramSeedItem[];
  branches: ProgramSeedBranch[];
}

/** Créneau ajouté entre ceux du planning projeté (repas, trajets, temps libres...). */
const PROPOSED_NOTE = 'Créneau proposé (absent du planning projeté) : à confirmer ou corriger.';
const SPLIT_NOTE = 'Temps séparé : un programme par groupe (TA / ES), voir les lieux « Groupe TA » et « Groupe ES ».';

export const PROGRAM_SEED_DAYS: ProgramSeedDay[] = [
  {
    // Dimanche 31 octobre — « Aller puiser à la source »
    eventDate: '2027-10-31',
    theme:
      'Aller puiser à la source - Se mettre en route avec Dieu - Découvrir la parole de Dieu - Faire l\'état des lieux de sa vie',
    slots: [
      { title: 'Accueil & installation des équipes', startTime: '10:00', durationMinutes: 120, minDurationMinutes: 60, proposed: true },
      { title: 'Repas', startTime: '12:00', durationMinutes: 75, minDurationMinutes: 45, proposed: true },
      { title: 'Trajet vers le lieu de lancement', startTime: '13:15', durationMinutes: 45, minDurationMinutes: 30, proposed: true },
      { title: 'Temps de lancement', startTime: '14:00', durationMinutes: 75, minDurationMinutes: 45 },
      {
        title: 'Eucharistie',
        startTime: '15:15',
        durationMinutes: 75,
        minDurationMinutes: 60,
        frozen: true,
        notes: 'Figé pour la démo : horaire à confirmer.',
      },
      { title: 'Goûter & temps libre', startTime: '16:30', durationMinutes: 45, minDurationMinutes: 30, proposed: true },
      { title: 'Retour aux hébergements & installation', startTime: '17:15', durationMinutes: 60, minDurationMinutes: 30, proposed: true },
      { title: 'Dîner', startTime: '18:30', durationMinutes: 75, minDurationMinutes: 45, proposed: true },
      { title: 'Veillée FESTIVE', startTime: '20:00', durationMinutes: 105, minDurationMinutes: 60 },
      { title: 'Retour aux hébergements & coucher', startTime: '21:45', durationMinutes: 45, minDurationMinutes: 30, proposed: true },
    ],
    branches: [],
  },
  {
    // Lundi 1er novembre — « Vivre la fraternité »
    eventDate: '2027-11-01',
    theme:
      "Vivre la fraternité - Découvrir le chemin des Béatitudes - Jouer en équipe - Se découvrir membre de l'Église",
    slots: [
      { title: 'Réveil & petit-déjeuner', startTime: '07:30', durationMinutes: 60, minDurationMinutes: 30, proposed: true },
      { title: 'Trajet vers les paroisses', startTime: '08:30', durationMinutes: 30, minDurationMinutes: 15, proposed: true },
      { title: 'Temps de la Parole - Messe en paroisse', startTime: '09:00', durationMinutes: 120, minDurationMinutes: 90, notes: SPLIT_NOTE },
      { title: 'Retour des paroisses & temps libre', startTime: '11:00', durationMinutes: 45, minDurationMinutes: 20, proposed: true },
      { title: 'Repas', startTime: '12:00', durationMinutes: 75, minDurationMinutes: 45, proposed: true },
      { title: 'Trajet vers le Musée de la Mine', startTime: '13:15', durationMinutes: 45, minDurationMinutes: 30, proposed: true },
      {
        title: 'Jeu dans la ville collaboratif - Rassemblement au Musée de la Mine',
        startTime: '14:00',
        durationMinutes: 150,
        minDurationMinutes: 90,
        notes: SPLIT_NOTE,
      },
      { title: 'Goûter', startTime: '16:30', durationMinutes: 30, minDurationMinutes: 20, proposed: true },
      { title: 'Retour aux hébergements', startTime: '17:00', durationMinutes: 60, minDurationMinutes: 30, proposed: true },
      { title: 'Dîner', startTime: '18:30', durationMinutes: 75, minDurationMinutes: 45, proposed: true },
      { title: 'Veillée Spectacle', startTime: '20:00', durationMinutes: 105, minDurationMinutes: 60 },
      { title: 'Retour aux hébergements & coucher', startTime: '21:45', durationMinutes: 45, minDurationMinutes: 30, proposed: true },
    ],
    branches: [
      {
        location: 'Groupe TA',
        items: [
          { slot: 2, title: 'Temps de la Parole - Messe en paroisse' },
          { slot: 6, title: 'Jeu dans la ville collaboratif avec ES - Rassemblement au Musée de la Mine' },
        ],
      },
      {
        location: 'Groupe ES',
        items: [
          { slot: 2, title: 'Temps de la parole - Messe en (autre) paroisse' },
          { slot: 6, title: 'Jeu dans la ville collaboratif avec TA - Rassemblement au Musée de la mine' },
        ],
      },
    ],
  },
  {
    // Mardi 2 novembre — « Rencontrer des témoins »
    eventDate: '2027-11-02',
    theme:
      'Rencontrer des témoins qui vivent les Béatitudes dans notre monde - Cultiver l\'Espérance - Prendre soin du monde',
    slots: [
      { title: 'Réveil & petit-déjeuner', startTime: '07:30', durationMinutes: 60, minDurationMinutes: 30, proposed: true },
      { title: 'Mise en route', startTime: '08:30', durationMinutes: 30, minDurationMinutes: 15, proposed: true },
      {
        title: 'Ateliers Défis / Actions / Services & table ronde avec des témoins',
        startTime: '09:00',
        durationMinutes: 150,
        minDurationMinutes: 90,
        notes: SPLIT_NOTE,
      },
      { title: 'Repas', startTime: '11:30', durationMinutes: 75, minDurationMinutes: 45, proposed: true },
      { title: 'Trajet vers le Crêt des 6 soleils', startTime: '12:45', durationMinutes: 45, minDurationMinutes: 30, proposed: true },
      { title: 'Grand Jeu / Balade au Crêt des 6 soleils', startTime: '13:30', durationMinutes: 120, minDurationMinutes: 60, notes: SPLIT_NOTE },
      { title: 'Goûter Crêt des 6 soleils - Moments fraternels', startTime: '15:30', durationMinutes: 60, minDurationMinutes: 30 },
      { title: 'Retour aux hébergements', startTime: '16:30', durationMinutes: 60, minDurationMinutes: 30, proposed: true },
      { title: 'Temps libre & douches', startTime: '17:30', durationMinutes: 60, minDurationMinutes: 30, proposed: true },
      { title: 'Dîner', startTime: '18:30', durationMinutes: 75, minDurationMinutes: 45, proposed: true },
      { title: 'Veillée SPI', startTime: '20:00', durationMinutes: 90, minDurationMinutes: 60, notes: SPLIT_NOTE },
      { title: 'Retour aux hébergements & coucher', startTime: '21:30', durationMinutes: 45, minDurationMinutes: 30, proposed: true },
    ],
    branches: [
      {
        location: 'Groupe TA',
        items: [
          { slot: 2, title: 'Ateliers Défis / Actions / Services (avec des témoins)' },
          { slot: 5, title: 'Grand Jeu au Crêt des 6 soleils' },
          { slot: 10, title: 'Veillée SPI - TA' },
        ],
      },
      {
        location: 'Groupe ES',
        items: [
          { slot: 2, title: 'Table ronde avec des témoins qui ont choisi la Joie + 2 ateliers' },
          { slot: 5, title: "Ballade jusqu'au crêt des 6 soleils" },
          { slot: 10, title: 'Veillée SPI - ES' },
        ],
      },
    ],
  },
  {
    // Mercredi 3 novembre — « Relire, faire des choix »
    eventDate: '2027-11-03',
    theme: "Relire - Faire des choix - Engagement - Projet « J'aime » - Célébrer la Joie",
    slots: [
      { title: 'Réveil & petit-déjeuner', startTime: '07:30', durationMinutes: 60, minDurationMinutes: 30, proposed: true },
      { title: 'Rangement des chambres & bagages', startTime: '08:30', durationMinutes: 45, minDurationMinutes: 30, proposed: true },
      { title: "Écriture des « J'aime »", startTime: '09:15', durationMinutes: 60, minDurationMinutes: 30 },
      { title: 'Eucharistie ouverte (démarches de choix)', startTime: '10:15', durationMinutes: 75, minDurationMinutes: 60 },
      { title: 'Clôture avec Mercis-Envoi', startTime: '11:30', durationMinutes: 45, minDurationMinutes: 30 },
      { title: "Repas d'au revoir", startTime: '12:15', durationMinutes: 75, minDurationMinutes: 45, proposed: true },
      { title: 'Départs des équipes', startTime: '13:30', durationMinutes: 60, minDurationMinutes: 30, proposed: true },
    ],
    branches: [],
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
  for (const [index, item] of day.slots.entries()) {
    const notes =
      [index === 0 && day.theme ? `Thème du jour : ${day.theme}` : null, item.proposed ? PROPOSED_NOTE : null, item.notes]
        .filter(Boolean)
        .join('\n') || null;
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
          notes,
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
