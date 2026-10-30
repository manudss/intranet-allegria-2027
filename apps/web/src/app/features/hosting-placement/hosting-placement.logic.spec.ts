import { describe, expect, it } from 'vitest';
import { familyLoad, groupFill, groupStats, isMinorAt, unplacedMembers } from './hosting-placement.logic';
import { Board } from './hosting-placement.models';

const board: Board = {
  hostingGroups: [{ id: 1, name: 'A', notes: null }],
  teams: [
    { id: 10, name: 'T1', groupName: null, hostingGroupId: 1, memberCount: 3 },
    { id: 11, name: 'T2', groupName: null, hostingGroupId: null, memberCount: 1 },
  ],
  members: [
    { participantId: 1, firstName: 'A', lastName: 'B', sex: 'FEMALE', type: 'JEUNE', dateOfBirth: '2012-05-01', teamId: 10, assignmentId: 1, hostFamilyId: 5, assignmentStatus: 'PENDING' },
    { participantId: 2, firstName: 'C', lastName: 'D', sex: 'MALE', type: 'ANIMATEUR', dateOfBirth: '1990-05-01', teamId: 10, assignmentId: null, hostFamilyId: null, assignmentStatus: null },
    { participantId: 3, firstName: 'E', lastName: 'F', sex: 'MALE', type: 'JEUNE', dateOfBirth: '2012-05-01', teamId: 10, assignmentId: null, hostFamilyId: null, assignmentStatus: null },
    { participantId: 4, firstName: 'G', lastName: 'H', sex: 'MALE', type: 'JEUNE', dateOfBirth: '2012-05-01', teamId: 11, assignmentId: null, hostFamilyId: null, assignmentStatus: null },
  ],
  families: [
    { id: 5, familyName: 'F5', city: 'Lyon', parish: null, maxCapacity: 2, maxUnder18: 2, maxAnimators: 1, status: 'VALIDATED', hostingGroupId: 1, constraints: [], tags: [] },
    { id: 6, familyName: 'F6', city: 'Lyon', parish: null, maxCapacity: 9, maxUnder18: 9, maxAnimators: null, status: 'DRAFT', hostingGroupId: 1, constraints: [], tags: [] },
  ],
  conflicts: [],
};

describe('hosting placement logic', () => {
  it('calcule mineur à la date de référence', () => {
    expect(isMinorAt('2009-11-01', '2027-10-30')).toBe(true);
    expect(isMinorAt('2009-10-30', '2027-10-30')).toBe(false);
  });
  it('compte les places des familles validées seulement', () => {
    expect(groupStats(board, 1)).toEqual({ teams: 1, families: 2, people: 3, placed: 1, seats: 2 });
  });
  it('calcule la charge d’une famille', () => {
    const load = familyLoad(board, board.families[0], '2027-10-30');
    expect(load).toMatchObject({ used: 1, minors: 1, animators: 0, full: false });
  });
  it('liste les personnes sans famille d’un groupe', () => {
    expect(unplacedMembers(board, 1).map((m) => m.participantId)).toEqual([2, 3]);
  });
});

describe('groupFill', () => {
  const st = (people: number, seats: number) => ({ teams: 0, families: 0, people, placed: 0, seats });
  it('classe vide, places libres, complet et manque de places', () => {
    expect(groupFill(st(0, 5)).state).toBe('empty');
    expect(groupFill(st(3, 5))).toMatchObject({ state: 'under', free: 2, percent: 60 });
    expect(groupFill(st(5, 5)).state).toBe('full');
    expect(groupFill(st(7, 5))).toMatchObject({ state: 'over', missing: 2 });
  });
  it('sans place et avec des personnes : manque de places', () => {
    expect(groupFill(st(2, 0))).toMatchObject({ state: 'over', percent: 0, missing: 2 });
  });
  it('classe 40 groupes selon la règle existante, sans seuil inventé', () => {
    // 40 groupes, 4 vides puis 20 personnes ; places = 0, 10, 20, 30 en rotation
    const seatsBy = [0, 10, 20, 30];
    const fills = Array.from({ length: 40 }, (_, i) => groupFill(st(i % 10 === 0 ? 0 : 20, seatsBy[i % 4])));
    const count = (s: string) => fills.filter((f) => f.state === s).length;
    expect(count('empty') + count('under') + count('full') + count('over')).toBe(40);
    expect(count('empty')).toBe(4);
    expect(count('over')).toBe(18);
    expect(count('full')).toBe(8);
    expect(count('under')).toBe(10);
    expect(fills.filter((f) => f.state === 'under').every((f) => f.free > 0)).toBe(true);
  });
});
