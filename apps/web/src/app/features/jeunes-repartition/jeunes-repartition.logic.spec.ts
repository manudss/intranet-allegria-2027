import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS,
  buildApplyEntries,
  displayName,
  isPending,
  originLabel,
  sexShort,
  teamCountsWithPending,
} from './jeunes-repartition.logic';

const team = { id: 7, maxSize: 12, jeunesCount: 4, adultesCount: 1 };

describe('jeunes-repartition logic', () => {
  it('défauts validés : 6 jeunes et 1 animateur par équipe', () => {
    expect(DEFAULT_PARAMS.jeunesPerTeam).toBe(6);
    expect(DEFAULT_PARAMS.adultsPerTeam).toBe(1);
    expect(DEFAULT_PARAMS.moveAssigned).toBe(false);
  });

  it('teamCountsWithPending applique le delta des affectations en cours', () => {
    const pool = [
      { id: 1, type: 'JEUNE' as const },
      { id: 2, type: 'JEUNE' as const },
      { id: 3, type: 'ANIMATEUR' as const },
    ];
    const initial = new Map<number, number | null>([[1, null], [2, 7], [3, null]]);
    const desired = new Map<number, number | null>([[1, 7], [2, null], [3, 7]]);

    const counts = teamCountsWithPending(team, pool, desired, initial);
    expect(counts.jeunes).toBe(4); // +1 jeune (id 1), -1 jeune (id 2)
    expect(counts.adultes).toBe(2); // +1 animateur
    expect(counts.free).toBe(6);
  });

  it('isPending compare l état affiché à l état enregistré', () => {
    const initial = new Map<number, number | null>([[1, null], [2, 7]]);
    const desired = new Map<number, number | null>([[1, 7], [2, 7]]);
    expect(isPending(1, desired, initial)).toBe(true);
    expect(isPending(2, desired, initial)).toBe(false);
  });

  it('buildApplyEntries ne garde que les changements', () => {
    const initial = new Map<number, number | null>([[1, null], [2, 7], [3, 5]]);
    const desired = new Map<number, number | null>([[1, 7], [2, 7], [3, null]]);
    expect(buildApplyEntries([1, 2, 3], desired, initial)).toEqual([
      { participantId: 1, teamId: 7 },
      { participantId: 3, teamId: null },
    ]);
  });

  it('displayName masque le nom d un jeune', () => {
    expect(displayName({ firstName: 'Léa', lastName: null, type: 'JEUNE' })).toBe('Léa');
    expect(displayName({ firstName: 'Léa', lastName: 'Martin', type: 'JEUNE' })).toBe('Léa');
    expect(displayName({ firstName: 'Marc', lastName: 'Dupont', type: 'ANIMATEUR' })).toBe('Marc Dupont');
  });

  it('sexShort et originLabel selon la granularité', () => {
    expect(sexShort('FEMALE')).toBe('F');
    expect(sexShort('MALE')).toBe('G');
    expect(sexShort(null)).toBe('—');
    const row = { groupName: 'MEJ Roanne', city: 'Roanne', diocese: 'Lyon' };
    expect(originLabel(row, 'group')).toBe('MEJ Roanne');
    expect(originLabel(row, 'city')).toBe('Roanne');
    expect(originLabel(row, 'diocese')).toBe('Lyon');
  });
});
