import { Injectable, signal } from '@angular/core';
import {
  ProgramChangeLogEntry,
  ProgramSequence,
  ProgramSequenceStatus,
} from '../../models/models';
import { computeEndTime } from './schedule-time.util';
import { ALLEGRIA_2027_EVENT_DATES } from '../../shared/event-date-selector/event-date.config';

function s(
  id: string,
  title: string,
  startTime: string,
  durationMinutes: number,
  overrides: Partial<ProgramSequence> = {},
): ProgramSequence {
  return {
    id,
    eventDate: ALLEGRIA_2027_EVENT_DATES.startDate,
    location: 'Grand Chapiteau',
    title,
    startTime,
    durationMinutes,
    endTime: computeEndTime(startTime, durationMinutes),
    status: ProgramSequenceStatus.MOBILE,
    minDurationMinutes: null,
    minMarginMinutes: null,
    previousSequenceId: null,
    anchorSequenceId: null,
    volunteerTeamId: null,
    volunteerTeamName: null,
    missionIds: [],
    documentLinks: [],
    notes: null,
    frozenByUserId: null,
    frozenByUserName: null,
    frozenAt: null,
    ...overrides,
  };
}

/** Calcule la 2e date de l'événement (J2) à partir de la config des 4 jours. */
function dayOffset(offset: number): string {
  const start = new Date(`${ALLEGRIA_2027_EVENT_DATES.startDate}T00:00:00`);
  start.setDate(start.getDate() + offset);
  return start.toISOString().slice(0, 10);
}

export const PROGRAM_EVENT_DAYS = [0, 1, 2, 3].map((offset) => dayOffset(offset));

const J2 = PROGRAM_EVENT_DAYS[1];

/**
 * Jeu de données mocké pour le prototype (Phase 0) : la chaîne J2 "Grand
 * Chapiteau" issue du squelette métier fourni, avec un créneau figé et des
 * branches parallèles (ateliers thématiques) rattachées à un point d'ancrage.
 */
function buildMockSequences(): ProgramSequence[] {
  const reveil = s('j2-reveil', 'Réveil & petit-déjeuner', '07:00', 60, {
    eventDate: J2,
    minDurationMinutes: 30,
    volunteerTeamName: 'Équipe Restauration',
  });
  const topo = s('j2-topo', "Topo d'ouverture", '08:00', 30, {
    eventDate: J2,
    minDurationMinutes: 15,
    previousSequenceId: reveil.id,
    volunteerTeamName: 'Équipe Animation',
    documentLinks: [{ label: 'Trame topo', url: 'https://partage.allegria2027.fr/topo-j2' }],
  });
  const tempsFort = s('j2-temps-fort', 'Temps fort liturgique', '08:30', 90, {
    eventDate: J2,
    minDurationMinutes: 60,
    previousSequenceId: topo.id,
    status: ProgramSequenceStatus.FROZEN,
    frozenByUserId: 1,
    frozenByUserName: 'Coordination Allegria',
    frozenAt: '2027-09-15T10:00:00.000Z',
    volunteerTeamName: 'Équipe Liturgie',
    notes: 'Horaire validé avec le diocèse : ne pas décaler.',
  });
  const ateliers = s('j2-ateliers', 'Ateliers thématiques par branche', '10:00', 120, {
    eventDate: J2,
    minDurationMinutes: 60,
    previousSequenceId: tempsFort.id,
    volunteerTeamName: 'Équipe Animation',
  });
  const repas = s('j2-repas', 'Repas', '12:00', 75, {
    eventDate: J2,
    minDurationMinutes: 45,
    previousSequenceId: ateliers.id,
    volunteerTeamName: 'Équipe Restauration',
  });
  const grandJeu = s('j2-grand-jeu', 'Grand jeu inter-groupes', '13:15', 105, {
    eventDate: J2,
    minDurationMinutes: 60,
    previousSequenceId: repas.id,
    volunteerTeamName: 'Équipe Logistique',
  });
  const veillee = s('j2-veillee', 'Veillée', '19:00', 90, {
    eventDate: J2,
    minDurationMinutes: 60,
    previousSequenceId: grandJeu.id,
    volunteerTeamName: 'Équipe Animation',
  });

  // Branches parallèles des ateliers, rattachées au même point d'ancrage (ateliers).
  const branche1 = s('j2-atelier-chant', 'Atelier Chant', '10:00', 120, {
    eventDate: J2,
    location: 'Salle A',
    anchorSequenceId: ateliers.id,
    volunteerTeamName: 'Équipe Animation',
  });
  const branche2 = s('j2-atelier-artisanat', 'Atelier Artisanat', '10:00', 120, {
    eventDate: J2,
    location: 'Salle B',
    anchorSequenceId: ateliers.id,
    volunteerTeamName: 'Équipe Animation',
  });

  return [reveil, topo, tempsFort, ateliers, repas, grandJeu, veillee, branche1, branche2];
}

@Injectable({ providedIn: 'root' })
export class PlanningMockDataService {
  private readonly sequencesState = signal<ProgramSequence[]>(buildMockSequences());
  private readonly changeLogState = signal<ProgramChangeLogEntry[]>([]);

  readonly sequences = this.sequencesState.asReadonly();
  readonly changeLog = this.changeLogState.asReadonly();

  setSequences(sequences: ProgramSequence[]): void {
    this.sequencesState.set(sequences);
  }

  appendChangeLogEntry(entry: ProgramChangeLogEntry): void {
    this.changeLogState.update((entries) => [entry, ...entries]);
  }
}
