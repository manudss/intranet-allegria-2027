import { describe, expect, it } from 'vitest';
import { HostingPlacementService } from './hosting-placement.service';

const p = (id: number) => ({
  id,
  firstName: 'P' + id,
  lastName: 'N',
  sex: 'M',
  type: 'YOUTH',
  dateOfBirth: null,
});
const repo = (rows: unknown[]) => ({ find: async () => rows });

function build() {
  const teams = [{ id: 1, name: 'E1', group: null, hostingGroup: { id: 10 } }];
  const memberships = [
    { participant: p(1), team: { id: 1 } },
    { participant: p(2), team: { id: 1 } },
  ];
  const accessRights = {
    participantIdsInScope: async (scope: { all: boolean; groupIds?: number[] }, ids: number[]) =>
      scope.all
        ? new Set(ids)
        : new Set(ids.filter((i) => i === 1 && (scope.groupIds ?? []).includes(5))),
  };
  return new (HostingPlacementService as any)(
    repo([]),
    repo(teams),
    repo([]),
    repo(memberships),
    repo([]),
    accessRights,
  ) as HostingPlacementService;
}

describe('board par portée de groupe', () => {
  it('toute la portée voit tous les jeunes', async () => {
    const b = await build().board({ all: true });
    expect(b.members.map((m) => m.participantId)).toEqual([1, 2]);
  });
  it('portée groupes : seuls les jeunes du groupe, effectifs globaux', async () => {
    const b = await build().board({ all: false, groupIds: [5] });
    expect(b.members.map((m) => m.participantId)).toEqual([1]);
    expect(b.teams[0].memberCount).toBe(2);
  });
  it('sans portée : aucun jeune nominatif', async () => {
    const b = await build().board();
    expect(b.members).toEqual([]);
  });
});
