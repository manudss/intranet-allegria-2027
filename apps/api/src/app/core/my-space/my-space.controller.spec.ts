import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { VolunteerShiftAssignmentsService } from '../volunteer-shift-assignments/volunteer-shift-assignments.service';
import { VolunteerTeamsService } from '../volunteer-teams/volunteer-teams.service';
import { VolunteersService } from '../volunteers/volunteers.service';
import { MySpaceController } from './my-space.controller';

const req = { user: { id: 42, email: 'ben@example.com', roles: ['VOLUNTEERS'] } };
const volunteer = { id: 7, firstName: 'Ben', lastName: 'Martin', user: { id: 42 } };

const build = (overrides: Partial<VolunteersService> = {}) => {
  const volunteers = {
    findByUserId: vi.fn().mockResolvedValue(volunteer),
    ...overrides,
  } as unknown as VolunteersService;
  const assignments = {
    listVolunteerPlanning: vi.fn().mockResolvedValue([{ id: 1 }]),
  } as unknown as VolunteerShiftAssignmentsService;
  const teams = {
    listVolunteerMemberships: vi.fn().mockResolvedValue([{ id: 2 }]),
    listTeammates: vi.fn().mockResolvedValue([{ id: 3 }]),
  } as unknown as VolunteerTeamsService;
  return {
    controller: new MySpaceController(volunteers, assignments, teams),
    volunteers,
    assignments,
    teams,
  };
};

describe('MySpaceController', () => {
  it('retourne le profil bénévole rattaché à l utilisateur', async () => {
    const { controller, volunteers } = build();
    await expect(controller.getMyVolunteer(req)).resolves.toEqual(volunteer);
    expect(volunteers.findByUserId).toHaveBeenCalledWith(42);
  });

  it('renvoie 404 quand aucun profil bénévole n est rattaché', async () => {
    const { controller } = build({ findByUserId: vi.fn().mockResolvedValue(null) });
    await expect(controller.getMyVolunteer(req)).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.getMyShiftAssignments(req, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('délègue le planning au service avec le bon bénévole', async () => {
    const { controller, assignments } = build();
    await expect(controller.getMyShiftAssignments(req, {})).resolves.toEqual([{ id: 1 }]);
    expect(assignments.listVolunteerPlanning).toHaveBeenCalledWith(req.user, 7, undefined);
  });

  it('délègue les équipes au service avec le bon bénévole', async () => {
    const { controller, teams } = build();
    await expect(controller.getMyTeamMemberships(req)).resolves.toEqual([{ id: 2 }]);
    expect(teams.listVolunteerMemberships).toHaveBeenCalledWith(7);
  });

  it('retourne les équipiers de son équipe, limités à sa propre appartenance', async () => {
    const { controller, teams } = build();
    await expect(controller.getMyTeammates(req, 2)).resolves.toEqual([{ id: 3 }]);
    expect(teams.listTeammates).toHaveBeenCalledWith(7, 2);
  });

  it('renvoie 404 sur les équipiers quand aucun profil bénévole n est rattaché', async () => {
    const { controller } = build({ findByUserId: vi.fn().mockResolvedValue(null) });
    await expect(controller.getMyTeammates(req, 2)).rejects.toBeInstanceOf(NotFoundException);
  });
});
