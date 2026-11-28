import { describe, expect, it } from 'vitest';
import type { AssignmentEntry } from './delegations-api.service';
import { dragPayload, entryKeyOf, filterPeople, gaugeLabel } from './repartition-panels';

const entry = (id: number, type: 'PARTICIPANT' | 'VOLUNTEER', firstName: string, lastName: string) =>
  ({
    assignmentId: null,
    transportId: null,
    delegationId: 1,
    person: { personType: type, id, firstName, lastName, detail: null, delegationId: 1 },
  }) as unknown as AssignmentEntry;

const list = [
  entry(1, 'PARTICIPANT', 'Camille', 'Roche'),
  entry(2, 'VOLUNTEER', 'Hugo', 'Fabre'),
  entry(3, 'PARTICIPANT', 'Léa', 'Fontaine'),
];

describe('panneau des personnes à placer', () => {
  it('filtre par nom (prénom ou nom) sans tenir compte de la casse', () => {
    expect(filterPeople(list, 'fab', 'ALL').map(entryKeyOf)).toEqual(['VOLUNTEER:2']);
    expect(filterPeople(list, 'LÉA', 'ALL').map(entryKeyOf)).toEqual(['PARTICIPANT:3']);
  });
  it('filtre par rôle', () => {
    expect(filterPeople(list, '', 'PARTICIPANT')).toHaveLength(2);
    expect(filterPeople(list, '', 'VOLUNTEER')).toHaveLength(1);
  });
  it('glisser une ligne de la sélection déplace toute la sélection, sinon la ligne seule', () => {
    const sel = new Set(['PARTICIPANT:1', 'VOLUNTEER:2']);
    expect(dragPayload(sel, list[0]).sort()).toEqual(['PARTICIPANT:1', 'VOLUNTEER:2']);
    expect(dragPayload(sel, list[2])).toEqual(['PARTICIPANT:3']);
  });
  it('libellé de jauge avec ou sans capacité', () => {
    expect(gaugeLabel(12, 48)).toBe('12/48');
    expect(gaugeLabel(5, null)).toBe('5 placés, sans jauge');
  });
});
