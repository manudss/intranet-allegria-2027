import { Injectable } from '@nestjs/common';
import { ProgramSequenceStatus } from '../entities';
import { computeEndTime, minutesToTime, timeToMinutes } from './program-time.util';
import {
  ProgramInsertPreview,
  ProgramResizePreview,
  ProgramSequenceData,
  ProgramSequenceDiff,
  ProgramSequenceDraft,
} from './program-recalc.types';

function diffOf(before: ProgramSequenceData, after: ProgramSequenceData): ProgramSequenceDiff {
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

function withDuration(
  sequence: ProgramSequenceData,
  startTime: string,
  durationMinutes: number,
): ProgramSequenceData {
  return {
    ...sequence,
    startTime,
    durationMinutes,
    endTime: computeEndTime(startTime, durationMinutes),
  };
}

function slackOf(sequence: ProgramSequenceData): number {
  const floor = sequence.minDurationMinutes ?? 0;
  return Math.max(0, sequence.durationMinutes - floor);
}

/**
 * Moteur de recalcul du programme (chaîne de séquences). Service pur, sans
 * dépendance HTTP ni base de données : port fidèle de ScheduleEngineService
 * (apps/web), validé en phase 0.
 */
@Injectable()
export class ProgramRecalcService {
  /** Reconstruit la chaîne ordonnée d'un jour/lieu à partir des pointeurs previousSequenceId. */
  buildChain(
    sequences: ProgramSequenceData[],
    eventDate: string,
    location: string,
  ): ProgramSequenceData[] {
    const scoped = sequences.filter((s) => s.eventDate === eventDate && s.location === location);
    const byId = new Map(scoped.map((s) => [s.id, s]));
    const head = scoped.find(
      (s) => s.previousSequenceId === null || !byId.has(s.previousSequenceId),
    );
    if (!head) {
      return [];
    }

    const chain: ProgramSequenceData[] = [head];
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
    chain: ProgramSequenceData[],
    afterSequenceId: number,
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
    const nextSlack = nextAvailable ? slackOf(next as ProgramSequenceData) : 0;

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
        const updatedNext = withDuration(
          next,
          next.startTime,
          next.durationMinutes - takenFromNext,
        );
        affected.push(diffOf(next, updatedNext));
      }
    }

    return {
      kind: 'insert',
      afterSequenceId,
      draft,
      newSequence: {
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
        notes: draft.notes,
      },
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
    chain: ProgramSequenceData[],
    sequenceId: number,
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
    chain: ProgramSequenceData[],
    index: number,
    delta: number,
    newDurationMinutes: number,
  ): ProgramResizePreview {
    const target = chain[index];
    const affected: ProgramSequenceDiff[] = [];
    let remaining = delta;
    let stoppedAtFrozenId: number | null = null;

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
    } else if (stoppedAtFrozenId !== null) {
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
    chain: ProgramSequenceData[],
    index: number,
    delta: number,
    newDurationMinutes: number,
  ): ProgramResizePreview {
    const target = chain[index];
    const shiftEarlier = Math.abs(delta);
    const affected: ProgramSequenceDiff[] = [];
    let stoppedAtFrozenId: number | null = null;

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

    const marginMinutes = stoppedAtFrozenId !== null ? null : shiftEarlier;
    const message =
      stoppedAtFrozenId !== null
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
      outcome: 'ok',
      message,
    };
  }

  /**
   * Applique un aperçu d'insertion. La nouvelle séquence n'a pas encore d'id
   * (attribué à la persistance) : l'appelant la crée, puis reconnecte
   * `followingSequenceId` à elle via previousSequenceId.
   */
  applyInsert(
    chain: ProgramSequenceData[],
    preview: ProgramInsertPreview,
  ): { updated: ProgramSequenceData[]; followingSequenceId: number | null } {
    const updated = this.applyDiffs(chain, preview.affected);
    const afterIndex = chain.findIndex((s) => s.id === preview.afterSequenceId);
    const following = chain[afterIndex + 1] ?? null;
    return { updated, followingSequenceId: following?.id ?? null };
  }

  /** Applique un aperçu de redimensionnement et renvoie la chaîne résultante. */
  applyResize(chain: ProgramSequenceData[], preview: ProgramResizePreview): ProgramSequenceData[] {
    const target = chain.find((s) => s.id === preview.sequenceId);
    if (!target) {
      return chain;
    }
    const resized = chain.map((s) =>
      s.id === target.id ? withDuration(s, s.startTime, preview.newDurationMinutes) : s,
    );
    return this.applyDiffs(resized, preview.affected);
  }

  private applyDiffs(
    chain: ProgramSequenceData[],
    diffs: ProgramSequenceDiff[],
  ): ProgramSequenceData[] {
    const diffById = new Map(diffs.map((d) => [d.sequenceId, d]));
    return chain.map((s) => {
      const diff = diffById.get(s.id);
      return diff ? withDuration(s, diff.after.startTime, diff.after.durationMinutes) : s;
    });
  }
}
