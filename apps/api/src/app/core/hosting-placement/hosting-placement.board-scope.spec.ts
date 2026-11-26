import { describe, expect, it } from 'vitest';
import { HostingPlacementService } from './hosting-placement.service';

const p = (id: number) => ({ id, firstName: 'P' + id, lastName: 'N', sex: 'M', type: 'YOUTH', dateOfBirth: null });
const repo = (rows: unknown[]) => ({ find: async () => rows });

function build(showGlobal = false) {
  const teams = [
    { id: 1, name: 'E1', group: { id: 5, name: 'G5' }, hostingGroup: { id: 10 } },
    { id: 2, name: 'E2', group: { id: 6, name: 'G6' }, hostingGroup: { id: 11 } },
  ];
  const families = [
    { id: 1, familyName: 'Secret', city: 'X', hostingGroup: { id: 10 } },
    { id: 2, familyName: 'Autre', city: 'Y', hostingGroup: { id: 11 } },
  ];
  const hostingGroups = [
    { id: 10, name: 'H10' },
    { id: 11, name: 'H11' },
  ];
  const memberships = [
    { participant: p(1), team: { id: 1 } },
    { participant: p(2), team: { id: 2 } },
  ];
  const accessRights = {
    participantIdsInScope: async (scope: { all: boolean; groupIds?: number[] }, ids: number[]) =>
      scope.all ? new Set(ids) : new Set(ids.filter((i) => i === 1 && (scope.groupIds ?? []).includes(5))),
    getOption: async () => showGlobal,
  };
  return new (HostingPlacementService as any)(
    repo(hostingGroups), repo(teams), repo(families), repo(memberships), repo([]), accessRights,
  ) as HostingPlacementService;
}

describe('board par portée de groupe', () => {
  it('toute la portée voit tout', async () => {
    const b = await build().board({ all: true });
    expect(b.members.map((m) => m.participantId)).toEqual([1, 2]);
    expect(b.families).toHaveLength(2);
    expect(b.teams).toHaveLength(2);
  });
  it('portée groupes : jeunes, équipes et groupes d’hébergement du périmètre, aucune famille', async () => {
    const b = await build().board({ all: false, groupIds: [5] });
    expect(b.members.map((m) => m.participantId)).toEqual([1]);
    expect(b.teams.map((t) => t.id)).toEqual([1]);
    expect(b.hostingGroups.map((g) => g.id)).toEqual([10]);
    expect(b.families).toEqual([]);
    expect(JSON.stringify(b)).not.toContain('Secret');
  });
  it('option « autres équipes » : équipes et groupes d’hébergement globaux, jamais les familles ni les jeunes hors portée', async () => {
    const b = await build(true).board({ all: false, groupIds: [5] });
    expect(b.teams).toHaveLength(2);
    expect(b.families).toEqual([]);
    expect(JSON.stringify(b)).not.toContain('Secret');
    expect(b.members.map((m) => m.participantId)).toEqual([1]);
  });
  it('sans portée posée : rien de nominatif ni de famille', async () => {
    const b = await build().board();
    expect(b.members).toEqual([]);
    expect(b.families).toEqual([]);
    expect(b.teams).toEqual([]);
  });
});
