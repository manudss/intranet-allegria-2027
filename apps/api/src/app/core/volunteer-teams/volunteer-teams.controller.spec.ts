import { describe, expect, it, vi } from 'vitest';
import { VolunteerTeamsController } from './volunteer-teams.controller';
import { VolunteerTeamsService } from './volunteer-teams.service';

describe('VolunteerTeamsController', () => {
  it('delegue la creation dune equipe au service', async () => {
    const team = { id: 1, name: 'Equipe A' };
    const service = {
      createTeam: vi.fn().mockResolvedValue(team),
    } as unknown as VolunteerTeamsService;
    const controller = new VolunteerTeamsController(service);
    const dto = { name: 'Equipe A', code: 'TEAM_A', description: null, isActive: true };

    await expect(controller.createTeam(dto)).resolves.toEqual(team);
    expect(service.createTeam).toHaveBeenCalledWith(dto);
  });

  it('delegue la liste des rattachements d un benevole au service', async () => {
    const memberships = [{ id: 7 }];
    const service = {
      listVolunteerMemberships: vi.fn().mockResolvedValue(memberships),
    } as unknown as VolunteerTeamsService;
    const controller = new VolunteerTeamsController(service);

    await expect(controller.listVolunteerMemberships(12)).resolves.toEqual(memberships);
    expect(service.listVolunteerMemberships).toHaveBeenCalledWith(12);
  });
});
