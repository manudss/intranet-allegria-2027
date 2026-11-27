import { describe, expect, it } from 'vitest';
import {
  derivedDelegationIds,
  isTeamEmpty,
  isTeamInScope,
  isTeamWritableInScope,
} from './team-scope';

const member = (groupId: number | null) => ({
  participant: { group: groupId === null ? null : { id: groupId } },
});

const scope = (groupIds: number[]) => ({ all: false, groupIds });
const ALL = { all: true, groupIds: [] as number[] };

describe('délégations dérivées des membres (team-scope)', () => {
  it('déduit les délégations distinctes des membres, triées', () => {
    expect(derivedDelegationIds({ members: [member(6), member(5), member(6)] })).toEqual([5, 6]);
  });

  it('ignore les membres sans délégation rattachée', () => {
    expect(derivedDelegationIds({ members: [member(null), member(5)] })).toEqual([5]);
    expect(derivedDelegationIds({ members: [member(null)] })).toEqual([]);
  });

  it('équipe vide ou sans membres : aucune délégation', () => {
    expect(derivedDelegationIds({ members: [] })).toEqual([]);
    expect(derivedDelegationIds({})).toEqual([]);
    expect(isTeamEmpty({ members: [] })).toBe(true);
    expect(isTeamEmpty({ members: [member(null)] })).toBe(false);
  });
});

describe('lecture : visibilité dérivée (isTeamInScope)', () => {
  it('visible si au moins un membre est rattaché à une délégation de la portée', () => {
    expect(isTeamInScope({ members: [member(5)] }, scope([5]))).toBe(true);
  });

  it('équipe mixte : visible des deux côtés, sans ouvrir les personnes de l’autre délégation', () => {
    const mixed = { members: [member(5), member(6)] };
    expect(isTeamInScope(mixed, scope([5]))).toBe(true);
    expect(isTeamInScope(mixed, scope([6]))).toBe(true);
    expect(isTeamInScope(mixed, scope([7]))).toBe(false);
  });

  it('négatif : équipe dont tous les membres sont dans une autre délégation → invisible', () => {
    expect(isTeamInScope({ members: [member(6)] }, scope([5]))).toBe(false);
  });

  it('négatif : équipe vide → invisible d’un compte limité, visible en portée « tout »', () => {
    expect(isTeamInScope({ members: [] }, scope([5]))).toBe(false);
    expect(isTeamInScope({ members: [] }, ALL)).toBe(true);
  });

  it('négatif : portée vide → rien de visible', () => {
    expect(isTeamInScope({ members: [member(5)] }, scope([]))).toBe(false);
  });
});

describe('composition : écriture dérivée (isTeamWritableInScope)', () => {
  it('équipe dans la portée dérivée : modifiable', () => {
    expect(isTeamWritableInScope({ members: [member(5)] }, scope([5]))).toBe(true);
  });

  it('équipe vide : neutre, elle rejoint la portée du premier membre rattaché', () => {
    expect(isTeamWritableInScope({ members: [] }, scope([5]))).toBe(true);
  });

  it('négatif : équipe entièrement hors portée → pas de composition, même avec un membre à soi à ajouter', () => {
    expect(isTeamWritableInScope({ members: [member(6)] }, scope([5]))).toBe(false);
  });

  it('négatif : équipe de membres sans délégation → hors portée dérivée', () => {
    expect(isTeamWritableInScope({ members: [member(null)] }, scope([5]))).toBe(false);
  });

  it('portée « tout » : toujours autorisé', () => {
    expect(isTeamWritableInScope({ members: [member(6)] }, ALL)).toBe(true);
    expect(isTeamWritableInScope({ members: [] }, ALL)).toBe(true);
  });
});
