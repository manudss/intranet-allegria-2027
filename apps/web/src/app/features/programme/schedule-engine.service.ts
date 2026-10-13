import { Injectable } from '@angular/core';
import {
  ProgramInsertPreview,
  ProgramResizePreview,
  ProgramSequence,
  ProgramSequenceDiff,
  ProgramSequenceDraft,
  ProgramSequenceStatus,
} from '../../models/models';
import { computeEndTime, minutesToTime, timeToMinutes } from './schedule-time.util';

let mockIdCounter = 0;

function nextMockId(prefix: string): string {
  mockIdCounter += 1;
  return `${prefix}-${mockIdCounter}`;
}

function diffOf(before: ProgramSequence, after: ProgramSequence): ProgramSequenceDiff {
  return {
    sequenceId: before.id,
    title: before.title,
    before: {
      startTime: before.startTime,
      endTime: before.endTime,
      durationMinutes: before.durationMinutes,
    },
    after: {
      startTime: after.startTime,
      endTime: after.endTime,
      durationMinutes: after.durationMinutes,
    },
  };
}

function withDuration(sequence: ProgramSequence, startTime: string, durationMinutes: number): ProgramSequence {
  return {
    ...sequence,
    startTime,
    durationMinutes,
    endTime: computeEndTime(startTime, durationMinutes),
  };
}

function slackOf(sequence: ProgramSequence): number {
  const floor = sequence.minDurationMinutes ?? 0;
  return Math.max(0, sequence.durationMinutes - floor);
}

/**
 * Moteur de recalcul du programme (chaîne de séquences). Service pur, sans
 * dépendance HTTP, pour pouvoir être testé unitairement et servir de
 * spécification exécutable au futur ProgramRecalcService NestJS (phase 1).
 */
@Injectable({ providedIn: 'root' })
export class ScheduleEngineService {
  /** Reconstruit la chaîne ordonnée d'un jour/lieu à partir des pointeurs previousSequenceId. */
  buildChain(sequences: ProgramSequence[], eventDate: string, location: string): ProgramSequence[] {
    const scoped = sequences.filter((s) => s.eventDate === eventDate && s.location === location);
    const byId = new Map(scoped.map((s) => [s.id, s]));
    const head = scoped.find((s) => s.previousSequenceId === null || !byId.has(s.previousSequenceId));
    if (!head) {
      return [];
    }

    const chain: ProgramSequence[] = [head];
    let current = head;
    // Garde-fou anti-boucle infinie en cas de données corrompues.
    for (let i = 0; i < scoped.length; i++) {
      const next = scoped.find((s) => s.previousSequenceId === current.id);
      if (!next) break;
      chain.push(next);
      current = next;
    }
    return chain;
  }

  /**
   * Prévisualise l'insertion d'une nouvelle séquence après `afterSequenceId`.
   * Règle : répartition 50/50 de la durée insérée sur les deux voisins si
   * possible ; sinon report total sur le seul voisin disponible ; sinon
   * statut "impossible" nécessitant une décision manuelle.
   */
  previewInsert(
    chain: ProgramSequence[],
    afterSequenceId: string,
    draft: ProgramSequenceDraft,
  ): ProgramInsertPreview {
    const index = chain.findIndex((s) => s.id === afterSequenceId);
    if (index === -1) {
      throw new Error(`Séquence introuvable: ${afterSequenceId}`);
    }

    const duration = draft.durationMinutes;
    const previous = chain[index];
    const next = chain[index + 1] ?? null;

    const previousAvailable = previous.status !== ProgramSequenceStatus.FROZEN;
    const nextAvailable = !!next && next.status !== ProgramSequenceStatus.FROZEN;
    const previousSlack = previousAvailable ? slackOf(previous) : 0;
    const nextSlack = nextAvailable ? slackOf(next as ProgramSequence) : 0;

    const halfUp = Math.ceil(duration / 2);
    const halfDown = duration - halfUp;

    let takenFromPrevious = 0;
    let takenFromNext = 0;
    let outcome: ProgramInsertPreview['outcome'] = 'ok';
    let message = '';

    if (previousSlack >= halfUp && nextSlack >= halfDown) {
      takenFromPrevious = halfUp;
      takenFromNext = halfDown;
      message = `Impact réparti : ${takenFromPrevious} min sur « ${previous.title} », ${takenFromNext} min sur « ${next?.title} ».`;
    } else if (previousSlack >= duration) {
      takenFromPrevious = duration;
      message = `Impact reporté en totalité sur « ${previous.title} » (voisin suivant indisponible ou insuffisant).`;
    } else if (nextSlack >= duration) {
      takenFromNext = duration;
      message = `Impact reporté en totalité sur « ${next?.title} » (voisin précédent indisponible ou insuffisant).`;
    } else {
      outcome = 'impossible';
      message =
        'Aucun des deux voisins ne peut absorber ce créneau (figement ou durée minimale atteinte). Décision manuelle requise.';
    }

    const affected: ProgramSequenceDiff[] = [];
    let newStartTime = previous.endTime;

    if (outcome !== 'impossible') {
      if (takenFromPrevious > 0) {
        const updatedPrevious = withDuration(
          previous,
          previous.startTime,
          previous.durationMinutes - takenFromPrevious,
        );
        affected.push(diffOf(previous, updatedPrevious));
        newStartTime = updatedPrevious.endTime;
      }
      if (takenFromNext > 0 && next) {
        const updatedNext = withDuration(next, next.startTime, next.durationMinutes - takenFromNext);
        affected.push(diffOf(next, updatedNext));
      }
    }

    const newSequence: ProgramSequence = {
      id: nextMockId('seq'),
      eventDate: draft.eventDate,
      location: draft.location,
      title: draft.title,
      startTime: newStartTime,
      durationMinutes: duration,
      endTime: computeEndTime(newStartTime, duration),
      status: ProgramSequenceStatus.MOBILE,
      minDurationMinutes: draft.minDurationMinutes ?? null,
      minMarginMinutes: draft.minMarginMinutes ?? null,
      previousSequenceId: previous.id,
      anchorSequenceId: null,
      volunteerTeamId: draft.volunteerTeamId,
      volunteerTeamName: null,
      missionIds: [],
      documentLinks: [],
      notes: draft.notes,
      frozenByUserId: null,
      frozenByUserName: null,
      frozenAt: null,
    };

    return {
      kind: 'insert',
      afterSequenceId,
      draft,
      newSequence,
      affected,
      outcome,
      message,
    };
  }

  /**
   * Prévisualise le redimensionnement d'une séquence.
   * Agrandissement : absorbe le delta sur les créneaux flexibles suivants les
   * plus proches, jamais sur un figé.
   * Réduction : avance la suite flexible et laisse une marge libre en fin de
   * programme ; s'arrête au premier créneau figé rencontré.
   */
  previewResize(
    chain: ProgramSequence[],
    sequenceId: string,
    newDurationMinutes: number,
  ): ProgramResizePreview {
    const index = chain.findIndex((s) => s.id === sequenceId);
    if (index === -1) {
      throw new Error(`Séquence introuvable: ${sequenceId}`);
    }

    const target = chain[index];
    const delta = newDurationMinutes - target.durationMinutes;

    if (delta === 0) {
      return {
        kind: 'resize',
        sequenceId,
        previousDurationMinutes: target.durationMinutes,
        newDurationMinutes,
        affected: [],
        stoppedAtFrozenId: null,
        marginMinutes: null,
        outcome: 'ok',
        message: 'Aucun changement.',
      };
    }

    return delta > 0
      ? this.previewEnlarge(chain, index, delta, newDurationMinutes)
      : this.previewReduce(chain, index, delta, newDurationMinutes);
  }

  private previewEnlarge(
    chain: ProgramSequence[],
    index: number,
    delta: number,
    newDurationMinutes: number,
  ): ProgramResizePreview {
    const target = chain[index];
    const affected: ProgramSequenceDiff[] = [];
    let remaining = delta;
    let stoppedAtFrozenId: string | null = null;

    for (let i = index + 1; i < chain.length && remaining > 0; i++) {
      const sequence = chain[i];
      if (sequence.status === ProgramSequenceStatus.FROZEN) {
        stoppedAtFrozenId = sequence.id;
        break;
      }
      // La séquence est poussée de `remaining` minutes ; elle absorbe ce qu'elle
      // peut (sa marge) et répercute le solde sur la suivante.
      const shiftedStart = minutesToTime(timeToMinutes(sequence.startTime) + remaining);
      const slack = slackOf(sequence);
      const take = Math.min(slack, remaining);
      const updated = withDuration(sequence, shiftedStart, sequence.durationMinutes - take);
      affected.push(diffOf(sequence, updated));
      remaining -= take;
    }

    let outcome: ProgramResizePreview['outcome'];
    let message: string;
    if (remaining === 0) {
      outcome = 'ok';
      message = `Agrandissement de ${delta} min absorbé sur les créneaux flexibles suivants.`;
    } else if (stoppedAtFrozenId) {
      outcome = affected.length > 0 ? 'partial' : 'impossible';
      message = `Agrandissement bloqué par un créneau figé après absorption partielle de ${delta - remaining} min sur ${delta} min. Décision manuelle requise.`;
    } else {
      outcome = 'partial';
      message = `Agrandissement de ${delta - remaining} min absorbé ; le programme se termine ${remaining} min plus tard.`;
    }

    return {
      kind: 'resize',
      sequenceId: target.id,
      previousDurationMinutes: target.durationMinutes,
      newDurationMinutes,
      affected,
      stoppedAtFrozenId,
      marginMinutes: null,
      outcome,
      message,
    };
  }

  private previewReduce(
    chain: ProgramSequence[],
    index: number,
    delta: number,
    newDurationMinutes: number,
  ): ProgramResizePreview {
    const target = chain[index];
    const shiftEarlier = Math.abs(delta);
    const affected: ProgramSequenceDiff[] = [];
    let stoppedAtFrozenId: string | null = null;

    for (let i = index + 1; i < chain.length; i++) {
      const sequence = chain[i];
      if (sequence.status === ProgramSequenceStatus.FROZEN) {
        stoppedAtFrozenId = sequence.id;
        break;
      }
      const newStart = minutesToTime(timeToMinutes(sequence.startTime) - shiftEarlier);
      const updated = withDuration(sequence, newStart, sequence.durationMinutes);
      affected.push(diffOf(sequence, updated));
    }

    const marginMinutes = stoppedAtFrozenId ? null : shiftEarlier;
    const outcome: ProgramResizePreview['outcome'] = 'ok';
    const message = stoppedAtFrozenId
      ? `Réduction de ${shiftEarlier} min appliquée jusqu'au créneau figé ; la suite reste inchangée.`
      : `Réduction de ${shiftEarlier} min : la suite est avancée, ${shiftEarlier} min de marge libre en fin de programme.`;

    return {
      kind: 'resize',
      sequenceId: target.id,
      previousDurationMinutes: target.durationMinutes,
      newDurationMinutes,
      affected,
      stoppedAtFrozenId,
      marginMinutes,
      outcome,
      message,
    };
  }

  /** Applique un aperçu d'insertion sur la chaîne et renvoie la nouvelle chaîne complète. */
  applyInsert(chain: ProgramSequence[], preview: ProgramInsertPreview): ProgramSequence[] {
    const byId = new Map(chain.map((s) => [s.id, s]));
    for (const diff of preview.affected) {
      const sequence = byId.get(diff.sequenceId);
      if (sequence) {
        byId.set(diff.sequenceId, withDuration(sequence, diff.after.startTime, diff.after.durationMinutes));
      }
    }

    const result: ProgramSequence[] = [];
    for (const sequence of chain) {
      result.push(byId.get(sequence.id) as ProgramSequence);
      if (sequence.id === preview.afterSequenceId) {
        result.push(preview.newSequence);
      }
    }

    // Reconnecte la séquence suivante à la nouvelle séquence insérée.
    const insertedIndex = result.findIndex((s) => s.id === preview.newSequence.id);
    const following = result[insertedIndex + 1];
    if (following) {
      result[insertedIndex + 1] = { ...following, previousSequenceId: preview.newSequence.id };
    }

    return result;
  }

  /** Applique un aperçu de redimensionnement sur la chaîne et renvoie la nouvelle chaîne complète. */
  applyResize(chain: ProgramSequence[], preview: ProgramResizePreview): ProgramSequence[] {
    const target = chain.find((s) => s.id === preview.sequenceId);
    if (!target) {
      return chain;
    }

    const byId = new Map(chain.map((s) => [s.id, s]));
    byId.set(
      preview.sequenceId,
      withDuration(target, target.startTime, preview.newDurationMinutes),
    );
    for (const diff of preview.affected) {
      const sequence = byId.get(diff.sequenceId);
      if (sequence) {
        byId.set(diff.sequenceId, withDuration(sequence, diff.after.startTime, diff.after.durationMinutes));
      }
    }

    return chain.map((s) => byId.get(s.id) as ProgramSequence);
  }

  /** Fige une séquence (action réservée coordination, horodatée et tracée). */
  freeze(sequence: ProgramSequence, userId: number, userName: string): ProgramSequence {
    return {
      ...sequence,
      status: ProgramSequenceStatus.FROZEN,
      frozenByUserId: userId,
      frozenByUserName: userName,
      frozenAt: new Date().toISOString(),
    };
  }

  /** Défige une séquence. */
  unfreeze(sequence: ProgramSequence): ProgramSequence {
    return {
      ...sequence,
      status: ProgramSequenceStatus.MOBILE,
      frozenByUserId: null,
      frozenByUserName: null,
      frozenAt: null,
    };
  }
}
