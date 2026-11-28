import { describe, expect, it } from 'vitest';
import { hasAll, hasAny, relationVisibility, roomDisplayName, type Grants } from './places.rights';

const g = (module: string, pairs: { level: 'VIEW' | 'EDIT' | 'MANAGE'; scope: 'ALL' | 'GROUPS' | 'OWN_TEAM' | 'SELF' }[]): Grants[string] =>
  ({ module, level: pairs[0].level, scope: pairs[0].scope, pairs, sources: [] }) as never;

describe('droits des relations d\'un lieu', () => {
  it('nom d\'affichage : lieu seul ou « Lieu · Salle »', () => {
    expect(roomDisplayName('Lycée Test', null)).toBe('Lycée Test');
    expect(roomDisplayName('Lycée Test', 'Salle 2')).toBe('Lycée Test · Salle 2');
  });

  it('sans aucun droit : tout est caché (échec fermé)', () => {
    expect(relationVisibility({})).toEqual({ events: false, missions: false, groups: false, teams: false, responsible: false });
  });

  it('chaque relation suit son module source', () => {
    const grants: Grants = { PLACES: g('PLACES', [{ level: 'MANAGE', scope: 'ALL' }]), AGENDA: g('AGENDA', [{ level: 'VIEW', scope: 'ALL' }]) };
    const v = relationVisibility(grants);
    expect(v.events).toBe(true);
    expect(v.missions).toBe(false); // droit sur les lieux ne donne pas les missions
    expect(v.groups).toBe(false);
    expect(v.teams).toBe(false);
  });

  it('groupes : tout, ou limités à ses groupes, ou rien', () => {
    expect(relationVisibility({ GATHERING_GROUPS: g('GATHERING_GROUPS', [{ level: 'VIEW', scope: 'ALL' }]) }).groups).toBe('ALL');
    expect(relationVisibility({ GATHERING_GROUPS: g('GATHERING_GROUPS', [{ level: 'VIEW', scope: 'GROUPS' }]) }).groups).toBe('OWN');
    expect(relationVisibility({ GATHERING_GROUPS: g('GATHERING_GROUPS', [{ level: 'VIEW', scope: 'SELF' }]) }).groups).toBe(false);
  });

  it('une portée partielle ne donne jamais « tout »', () => {
    const grants: Grants = { OPERATIONAL_TEAMS: g('OPERATIONAL_TEAMS', [{ level: 'MANAGE', scope: 'OWN_TEAM' }]) };
    expect(hasAll(grants, 'OPERATIONAL_TEAMS')).toBe(false);
    expect(hasAny(grants, 'OPERATIONAL_TEAMS')).toBe(true);
    expect(relationVisibility(grants).missions).toBe(false);
  });
});
