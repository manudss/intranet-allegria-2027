import { describe, expect, it } from 'vitest';
import {
  PlacementFamily,
  PlacementPerson,
  PlacementRules,
  proposePlacement,
  refusalReason,
} from './placement.algorithm';

const rules: PlacementRules = { countAnimatorsInCapacity: true, sexMixing: 'ignore' };

const person = (id: number, teamId: number, extra: Partial<PlacementPerson> = {}): PlacementPerson => ({
  id,
  teamId,
  isAnimator: false,
  isBenevole: false,
  isUnder18: true,
  sex: 'F',
  ...extra,
});

const family = (id: number, maxCapacity: number, extra: Partial<PlacementFamily> = {}): PlacementFamily => ({
  id,
  maxCapacity,
  maxUnder18: maxCapacity,
  maxAnimators: null,
  occupants: [],
  needsReview: false,
  ...extra,
});

describe('proposePlacement', () => {
  it('garde une équipe ensemble quand une famille a assez de places', () => {
    const people = [person(1, 10), person(2, 10), person(3, 10)];
    const { proposals, unplaced } = proposePlacement(people, [family(1, 2), family(2, 3)], rules);
    expect(unplaced).toEqual([]);
    expect(new Set(proposals.map((p) => p.hostFamilyId))).toEqual(new Set([2]));
  });

  it('répartit sur plusieurs familles sans dépasser la capacité', () => {
    const people = Array.from({ length: 5 }, (_, i) => person(i + 1, 10));
    const { proposals, unplaced } = proposePlacement(people, [family(1, 2), family(2, 3)], rules);
    expect(unplaced).toEqual([]);
    expect(proposals.filter((p) => p.hostFamilyId === 1)).toHaveLength(2);
    expect(proposals.filter((p) => p.hostFamilyId === 2)).toHaveLength(3);
  });

  it('tient compte de l’occupation existante et ne la modifie pas', () => {
    const occupied = family(1, 3, {
      occupants: [{ teamId: 99, isAnimator: false, isBenevole: false, isUnder18: true, sex: 'M' }],
    });
    const { proposals, unplaced } = proposePlacement(
      [person(1, 10), person(2, 10), person(3, 10)],
      [occupied],
      rules,
    );
    expect(proposals).toHaveLength(2);
    expect(unplaced.map((u) => u.reason)).toEqual(['NO_CAPACITY']);
    expect(occupied.occupants).toHaveLength(1);
  });

  it('respecte maxUnder18 et signale la raison', () => {
    const { proposals, unplaced } = proposePlacement(
      [person(1, 1), person(2, 1)],
      [family(1, 5, { maxUnder18: 1 })],
      rules,
    );
    expect(proposals).toHaveLength(1);
    expect(unplaced).toEqual([{ participantId: 2, reason: 'UNDER18_LIMIT' }]);
  });

  it('respecte maxAnimators', () => {
    const people = [
      person(1, 1, { isAnimator: true, isUnder18: false }),
      person(2, 1, { isAnimator: true, isUnder18: false }),
    ];
    const { proposals, unplaced } = proposePlacement(people, [family(1, 5, { maxAnimators: 1 })], rules);
    expect(proposals).toHaveLength(1);
    expect(unplaced[0].reason).toBe('ANIMATOR_LIMIT');
  });

  it('compte ou non les animateurs dans la capacité selon l’option', () => {
    const anim = person(1, 1, { isAnimator: true, isUnder18: false });
    const youth = person(2, 1);
    const together = proposePlacement([anim, youth], [family(1, 1)], rules);
    expect(together.proposals).toHaveLength(1);
    const apart = proposePlacement([anim, youth], [family(1, 1)], { ...rules, countAnimatorsInCapacity: false });
    expect(apart.proposals).toHaveLength(2);
  });

  it('interdit la mixité quand la règle est forbid', () => {
    const occupied = family(1, 4, {
      occupants: [{ teamId: 5, isAnimator: false, isBenevole: false, isUnder18: true, sex: 'M' }],
    });
    const forbid = proposePlacement([person(1, 1)], [occupied], { ...rules, sexMixing: 'forbid' });
    expect(forbid.unplaced).toEqual([{ participantId: 1, reason: 'SEX_MIXING' }]);
    const ignore = proposePlacement([person(1, 1)], [occupied], rules);
    expect(ignore.proposals).toHaveLength(1);
  });

  it('préfère une famille sans mixité quand la règle est avoid', () => {
    const withBoy = family(1, 4, {
      occupants: [{ teamId: 5, isAnimator: false, isBenevole: false, isUnder18: true, sex: 'M' }],
    });
    const { proposals } = proposePlacement([person(1, 1)], [withBoy, family(2, 4)], { ...rules, sexMixing: 'avoid' });
    expect(proposals[0].hostFamilyId).toBe(2);
  });

  it('marque les propositions vers une famille à relire', () => {
    const { proposals } = proposePlacement([person(1, 1)], [family(1, 2, { needsReview: true })], rules);
    expect(proposals[0].needsReview).toBe(true);
  });

  it('est déterministe', () => {
    const people = Array.from({ length: 12 }, (_, i) => person(i + 1, (i % 3) + 1));
    const families = [family(1, 4), family(2, 4), family(3, 4), family(4, 4)];
    expect(proposePlacement(people, families, rules)).toEqual(proposePlacement(people, families, rules));
  });

  it('refusalReason accepte une famille avec place', () => {
    expect(refusalReason(family(1, 2), person(1, 1), rules)).toBeNull();
  });

  describe('bénévoles adultes rattachés à une équipe', () => {
    const benevole = (id: number, teamId: number) =>
      person(id, teamId, { isAnimator: true, isBenevole: true, isUnder18: false, sex: '' });

    it('compte toujours dans la capacité, même si les animateurs n’y comptent pas', () => {
      const apart = proposePlacement([benevole(1, 1), person(2, 1)], [family(1, 1)], {
        ...rules,
        countAnimatorsInCapacity: false,
      });
      // Le bénévole prend une place : le jeune ne peut plus entrer (capacité 1).
      expect(apart.proposals).toHaveLength(1);
      expect(apart.unplaced).toEqual([{ participantId: 2, reason: 'NO_CAPACITY' }]);
    });

    it('compte dans le quota adultes (maxAnimators) comme un animateur', () => {
      const { proposals, unplaced } = proposePlacement(
        [benevole(1, 1), benevole(2, 1)],
        [family(1, 5, { maxAnimators: 1 })],
        rules,
      );
      expect(proposals).toHaveLength(1);
      expect(unplaced).toEqual([{ participantId: 2, reason: 'ANIMATOR_LIMIT' }]);
    });

    it('ne compte jamais dans le quota de mineurs', () => {
      const occupied = family(1, 5, {
        maxUnder18: 1,
        occupants: [{ teamId: 5, isAnimator: false, isBenevole: false, isUnder18: true, sex: 'M' }],
      });
      const { proposals, unplaced } = proposePlacement([benevole(1, 1)], [occupied], rules);
      expect(unplaced).toEqual([]);
      expect(proposals).toHaveLength(1);
    });

    it('est ignoré par la règle de mixité des jeunes', () => {
      const occupied = family(1, 4, {
        occupants: [{ teamId: 5, isAnimator: false, isBenevole: false, isUnder18: true, sex: 'M' }],
      });
      const forbid = proposePlacement([benevole(1, 1)], [occupied], { ...rules, sexMixing: 'forbid' });
      expect(forbid.unplaced).toEqual([]);
      expect(forbid.proposals).toHaveLength(1);
    });
  });
});
