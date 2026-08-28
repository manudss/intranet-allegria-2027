import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { VolunteerMissionStatus, VolunteerShiftStatus } from '../entities';
import { VolunteerMissionsService } from './volunteer-missions.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockShiftRepo(shiftStatus: VolunteerShiftStatus, shiftId = 10, missionId = 1) {
  return {
    create: vi.fn((payload) => payload),
    save: vi.fn(),
    remove: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn().mockResolvedValue({
      id: shiftId,
      missionId,
      status: shiftStatus,
      mission: { id: missionId, volunteerTeamId: null, responsibleVolunteerId: null },
      assignments: [],
    }),
  };
}

function makeMockMissionRepo(missionStatus = VolunteerMissionStatus.TODO) {
  return {
    create: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    find: vi.fn(),
    createQueryBuilder: vi.fn(),
    findOne: vi.fn().mockResolvedValue({
      id: 1,
      title: 'Mission test',
      status: missionStatus,
      isOptional: false,
      volunteerTeamId: null,
      responsibleVolunteerId: null,
      shifts: [],
    }),
  };
}

/**
 * Construit le service avec 7 repositories mockés :
 * missionsRepository, shiftsRepository, teamsRepository,
 * volunteersRepository, membershipsRepository,
 * missionStatusLogsRepository, shiftStatusLogsRepository
 */
function makeService(overrides: {
  shiftRepo?: ReturnType<typeof makeMockShiftRepo>;
  missionRepo?: ReturnType<typeof makeMockMissionRepo>;
  shiftLogSave?: ReturnType<typeof vi.fn>;
  missionLogSave?: ReturnType<typeof vi.fn>;
} = {}) {
  const shiftRepo = overrides.shiftRepo ?? makeMockShiftRepo(VolunteerShiftStatus.TODO);
  const missionRepo = overrides.missionRepo ?? makeMockMissionRepo();

  return new VolunteerMissionsService(
    missionRepo as never,
    shiftRepo as never,
    { findOneBy: vi.fn() } as never,
    { findOneBy: vi.fn(), findOne: vi.fn().mockResolvedValue(null) } as never,
    { find: vi.fn().mockResolvedValue([]) } as never,
    { save: overrides.missionLogSave ?? vi.fn().mockResolvedValue({}) } as never,
    { save: overrides.shiftLogSave ?? vi.fn().mockResolvedValue({}) } as never,
  );
}

const ADMIN = { id: 1, email: 'admin@test.fr', roles: ['ADMIN'] };
const COORDINATOR = { id: 2, email: 'coord@test.fr', roles: ['COORDINATOR'] };
const VOLUNTEER_WRITER = { id: 3, email: 'vol@test.fr', roles: ['VOLUNTEERS'] };

// ─── createShift ──────────────────────────────────────────────────────────────

describe('createShift', () => {
  it('refuse un shift dont endAt <= startAt', async () => {
    const service = makeService();
    vi.spyOn(service, 'findOne').mockResolvedValue({
      id: 1,
      volunteerTeamId: null,
      responsibleVolunteerId: null,
      status: VolunteerMissionStatus.TODO,
    } as never);

    await expect(
      service.createShift(ADMIN, 1, {
        startAt: '2027-07-24T12:00:00.000Z',
        endAt: '2027-07-24T10:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse une capacité non positive', async () => {
    const service = makeService();
    vi.spyOn(service, 'findOne').mockResolvedValue({
      id: 1,
      volunteerTeamId: null,
      responsibleVolunteerId: null,
      status: VolunteerMissionStatus.TODO,
    } as never);

    await expect(
      service.createShift(ADMIN, 1, {
        startAt: '2027-07-24T08:00:00.000Z',
        endAt: '2027-07-24T10:00:00.000Z',
        capacity: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ─── Transitions de statut de shift — valides ─────────────────────────────────

describe('changeShiftStatus — transitions valides', () => {
  async function expectTransitionAllowed(
    from: VolunteerShiftStatus,
    to: VolunteerShiftStatus,
    actor = ADMIN,
  ) {
    const shiftRepo = makeMockShiftRepo(from);
    const missionRepo = makeMockMissionRepo();
    const shiftLogSave = vi.fn().mockResolvedValue({});
    const service = makeService({ shiftRepo, missionRepo, shiftLogSave });

    vi.spyOn(service, 'findOne').mockResolvedValue({
      id: 1,
      volunteerTeamId: null,
      responsibleVolunteerId: null,
      status: VolunteerMissionStatus.IN_PROGRESS,
    } as never);

    await service.changeShiftStatus(actor, 1, 10, { status: to });

    expect(shiftRepo.save).toHaveBeenCalled();
    expect(shiftLogSave).toHaveBeenCalledWith(
      expect.objectContaining({ fromStatus: from, toStatus: to }),
    );
  }

  it('TODO → ASSIGNED', () => expectTransitionAllowed(VolunteerShiftStatus.TODO, VolunteerShiftStatus.ASSIGNED));
  it('TODO → IN_PROGRESS', () => expectTransitionAllowed(VolunteerShiftStatus.TODO, VolunteerShiftStatus.IN_PROGRESS));
  it('TODO → DONE', () => expectTransitionAllowed(VolunteerShiftStatus.TODO, VolunteerShiftStatus.DONE));
  it('TODO → NOT_DONE', () => expectTransitionAllowed(VolunteerShiftStatus.TODO, VolunteerShiftStatus.NOT_DONE));
  it('TODO → CANCELLED', () => expectTransitionAllowed(VolunteerShiftStatus.TODO, VolunteerShiftStatus.CANCELLED));
  it('ASSIGNED → IN_PROGRESS', () => expectTransitionAllowed(VolunteerShiftStatus.ASSIGNED, VolunteerShiftStatus.IN_PROGRESS));
  it('ASSIGNED → DONE', () => expectTransitionAllowed(VolunteerShiftStatus.ASSIGNED, VolunteerShiftStatus.DONE));
  it('ASSIGNED → NOT_DONE', () => expectTransitionAllowed(VolunteerShiftStatus.ASSIGNED, VolunteerShiftStatus.NOT_DONE));
  it('ASSIGNED → CANCELLED', () => expectTransitionAllowed(VolunteerShiftStatus.ASSIGNED, VolunteerShiftStatus.CANCELLED));
  it('IN_PROGRESS → DONE', () => expectTransitionAllowed(VolunteerShiftStatus.IN_PROGRESS, VolunteerShiftStatus.DONE));
  it('IN_PROGRESS → NOT_DONE', () => expectTransitionAllowed(VolunteerShiftStatus.IN_PROGRESS, VolunteerShiftStatus.NOT_DONE));
  it('IN_PROGRESS → CANCELLED', () => expectTransitionAllowed(VolunteerShiftStatus.IN_PROGRESS, VolunteerShiftStatus.CANCELLED));
  it('DONE → NOT_DONE (ADMIN)', () => expectTransitionAllowed(VolunteerShiftStatus.DONE, VolunteerShiftStatus.NOT_DONE, ADMIN));
  it('DONE → NOT_DONE (COORDINATOR)', () => expectTransitionAllowed(VolunteerShiftStatus.DONE, VolunteerShiftStatus.NOT_DONE, COORDINATOR));
});

// ─── Transitions de statut de shift — invalides ───────────────────────────────

describe('changeShiftStatus — transitions invalides', () => {
  async function expectTransitionRejected(
    from: VolunteerShiftStatus,
    to: VolunteerShiftStatus,
    actor = ADMIN,
    expectedError: new (...args: any[]) => Error = BadRequestException,
  ) {
    const shiftRepo = makeMockShiftRepo(from);
    const service = makeService({ shiftRepo });

    vi.spyOn(service, 'findOne').mockResolvedValue({
      id: 1,
      volunteerTeamId: null,
      responsibleVolunteerId: null,
      status: VolunteerMissionStatus.TODO,
    } as never);

    await expect(
      service.changeShiftStatus(actor, 1, 10, { status: to }),
    ).rejects.toBeInstanceOf(expectedError);
  }

  it('DONE → IN_PROGRESS est invalide', () =>
    expectTransitionRejected(VolunteerShiftStatus.DONE, VolunteerShiftStatus.IN_PROGRESS));

  it('DONE → ASSIGNED est invalide', () =>
    expectTransitionRejected(VolunteerShiftStatus.DONE, VolunteerShiftStatus.ASSIGNED));

  it('DONE → TODO est invalide', () =>
    expectTransitionRejected(VolunteerShiftStatus.DONE, VolunteerShiftStatus.TODO));

  it('DONE → CANCELLED est invalide', () =>
    expectTransitionRejected(VolunteerShiftStatus.DONE, VolunteerShiftStatus.CANCELLED));

  it('CANCELLED → TODO est invalide', () =>
    expectTransitionRejected(VolunteerShiftStatus.CANCELLED, VolunteerShiftStatus.TODO));

  it('CANCELLED → IN_PROGRESS est invalide', () =>
    expectTransitionRejected(VolunteerShiftStatus.CANCELLED, VolunteerShiftStatus.IN_PROGRESS));

  it('NOT_DONE → DONE est invalide', () =>
    expectTransitionRejected(VolunteerShiftStatus.NOT_DONE, VolunteerShiftStatus.DONE));

  it('NOT_DONE → TODO est invalide', () =>
    expectTransitionRejected(VolunteerShiftStatus.NOT_DONE, VolunteerShiftStatus.TODO));

  it('DONE → NOT_DONE est refusé pour un rôle non-ADMIN/COORDINATOR', () =>
    expectTransitionRejected(
      VolunteerShiftStatus.DONE,
      VolunteerShiftStatus.NOT_DONE,
      VOLUNTEER_WRITER,
      ForbiddenException,
    ));
});

// ─── Journalisation des transitions de shift ─────────────────────────────────

describe('changeShiftStatus — journalisation', () => {
  it('enregistre un log avec reason lors d\'une transition valide', async () => {
    const shiftLogSave = vi.fn().mockResolvedValue({});
    const shiftRepo = makeMockShiftRepo(VolunteerShiftStatus.TODO);
    const service = makeService({ shiftRepo, shiftLogSave });

    vi.spyOn(service, 'findOne').mockResolvedValue({
      id: 1,
      volunteerTeamId: null,
      responsibleVolunteerId: null,
      status: VolunteerMissionStatus.TODO,
    } as never);

    await service.changeShiftStatus(ADMIN, 1, 10, {
      status: VolunteerShiftStatus.IN_PROGRESS,
      reason: 'Début de service',
    });

    expect(shiftLogSave).toHaveBeenCalledWith(
      expect.objectContaining({
        shiftId: 10,
        fromStatus: VolunteerShiftStatus.TODO,
        toStatus: VolunteerShiftStatus.IN_PROGRESS,
        changedByUserId: ADMIN.id,
        reason: 'Début de service',
      }),
    );
  });
});

// ─── Transitions de statut de mission — valides ───────────────────────────────

describe('changeStatus (mission) — transitions valides', () => {
  async function expectMissionTransitionAllowed(
    from: VolunteerMissionStatus,
    to: VolunteerMissionStatus,
    actor = ADMIN,
  ) {
    const missionRepo = makeMockMissionRepo(from);
    const missionLogSave = vi.fn().mockResolvedValue({});
    const service = makeService({ missionRepo, missionLogSave });

    vi.spyOn(service, 'findOne').mockResolvedValue({
      id: 1,
      volunteerTeamId: null,
      responsibleVolunteerId: null,
      status: from,
    } as never);

    await service.changeStatus(actor, 1, { status: to });

    expect(missionRepo.save).toHaveBeenCalled();
    expect(missionLogSave).toHaveBeenCalledWith(
      expect.objectContaining({ fromStatus: from, toStatus: to }),
    );
  }

  it('DRAFT → TODO', () => expectMissionTransitionAllowed(VolunteerMissionStatus.DRAFT, VolunteerMissionStatus.TODO));
  it('DRAFT → CANCELLED', () => expectMissionTransitionAllowed(VolunteerMissionStatus.DRAFT, VolunteerMissionStatus.CANCELLED));
  it('TODO → IN_PROGRESS', () => expectMissionTransitionAllowed(VolunteerMissionStatus.TODO, VolunteerMissionStatus.IN_PROGRESS));
  it('TODO → DONE', () => expectMissionTransitionAllowed(VolunteerMissionStatus.TODO, VolunteerMissionStatus.DONE));
  it('TODO → NOT_DONE', () => expectMissionTransitionAllowed(VolunteerMissionStatus.TODO, VolunteerMissionStatus.NOT_DONE));
  it('TODO → CANCELLED', () => expectMissionTransitionAllowed(VolunteerMissionStatus.TODO, VolunteerMissionStatus.CANCELLED));
  it('IN_PROGRESS → DONE', () => expectMissionTransitionAllowed(VolunteerMissionStatus.IN_PROGRESS, VolunteerMissionStatus.DONE));
  it('IN_PROGRESS → NOT_DONE', () => expectMissionTransitionAllowed(VolunteerMissionStatus.IN_PROGRESS, VolunteerMissionStatus.NOT_DONE));
  it('IN_PROGRESS → CANCELLED', () => expectMissionTransitionAllowed(VolunteerMissionStatus.IN_PROGRESS, VolunteerMissionStatus.CANCELLED));
});

// ─── Transitions de statut de mission — invalides ────────────────────────────

describe('changeStatus (mission) — transitions invalides', () => {
  async function expectMissionTransitionRejected(
    from: VolunteerMissionStatus,
    to: VolunteerMissionStatus,
  ) {
    const service = makeService({ missionRepo: makeMockMissionRepo(from) });

    vi.spyOn(service, 'findOne').mockResolvedValue({
      id: 1,
      volunteerTeamId: null,
      responsibleVolunteerId: null,
      status: from,
    } as never);

    await expect(
      service.changeStatus(ADMIN, 1, { status: to }),
    ).rejects.toBeInstanceOf(BadRequestException);
  }

  it('DONE → TODO est invalide', () =>
    expectMissionTransitionRejected(VolunteerMissionStatus.DONE, VolunteerMissionStatus.TODO));

  it('DONE → IN_PROGRESS est invalide', () =>
    expectMissionTransitionRejected(VolunteerMissionStatus.DONE, VolunteerMissionStatus.IN_PROGRESS));

  it('CANCELLED → TODO est invalide', () =>
    expectMissionTransitionRejected(VolunteerMissionStatus.CANCELLED, VolunteerMissionStatus.TODO));

  it('NOT_DONE → DONE est invalide', () =>
    expectMissionTransitionRejected(VolunteerMissionStatus.NOT_DONE, VolunteerMissionStatus.DONE));
});

// ─── Journalisation des transitions de mission ───────────────────────────────

describe('changeStatus (mission) — journalisation', () => {
  it('enregistre un log avec reason et isForced', async () => {
    const missionLogSave = vi.fn().mockResolvedValue({});
    const service = makeService({ missionLogSave });

    vi.spyOn(service, 'findOne').mockResolvedValue({
      id: 1,
      volunteerTeamId: null,
      responsibleVolunteerId: null,
      status: VolunteerMissionStatus.TODO,
    } as never);

    await service.changeStatus(ADMIN, 1, {
      status: VolunteerMissionStatus.IN_PROGRESS,
      reason: 'Intervention urgente',
      force: true,
    });

    expect(missionLogSave).toHaveBeenCalledWith(
      expect.objectContaining({
        missionId: 1,
        fromStatus: VolunteerMissionStatus.TODO,
        toStatus: VolunteerMissionStatus.IN_PROGRESS,
        changedByUserId: ADMIN.id,
        reason: 'Intervention urgente',
        isForced: true,
      }),
    );
  });
});
