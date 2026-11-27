import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  AssignmentPersonType,
  TransportDirection,
  TransportMode,
} from '../entities';
import { DelegationsService } from './delegations.service';

const LYON = 1;
const ANNECY = 2;

const group = (id: number, name: string) => ({ id, name });

const participant = (id: number, delegationId: number | null, firstName = 'P', lastName = `N${id}`) => ({
  id,
  firstName,
  lastName,
  type: 'JEUNE',
  group: delegationId ? group(delegationId, `D${delegationId}`) : null,
});

const transport = (id: number, delegationId: number, capacity: number | null = 48) => ({
  id,
  delegation: group(delegationId, `D${delegationId}`),
  direction: TransportDirection.ALLER,
  transportMode: TransportMode.CAR,
  name: `Car ${id}`,
  departureDatetime: null,
  arrivalDatetime: null,
  meetingPoint: null,
  capacity,
  practicalInfo: null,
  notes: null,
  assignments: [],
});

const assignment = (
  id: number,
  personId: number,
  delegationId: number,
  transportId: number | null,
  direction = TransportDirection.ALLER,
) => ({
  id,
  personType: AssignmentPersonType.PARTICIPANT,
  personId,
  direction,
  delegation: group(delegationId, `D${delegationId}`),
  transport: transportId ? transport(transportId, delegationId) : null,
  createdAt: new Date('2026-11-01T10:00:00Z'),
});

type Row = Record<string, unknown>;

const repo = (rows: Row[] = []) => ({
  find: vi.fn(async (options?: { where?: (Row & { delegation?: { id?: number } }) | Row[] }) => {
    const where = (Array.isArray(options?.where) ? options?.where[0] : options?.where) as
      | (Row & { delegation?: { id?: number }; group?: { id?: number } })
      | undefined;
    if (!where) return rows;
    return rows.filter((r) => {
      if (where.id !== undefined) {
        const w = where.id as number | { _value?: number[] };
        if (typeof w === 'object' && w !== null && Array.isArray(w._value)) {
          if (!w._value.includes(r.id as number)) return false;
        } else if (r.id !== w) return false;
      }
      if (where.direction !== undefined && r.direction !== where.direction) return false;
      if (where.delegation?.id !== undefined) {
        const rDelegation = (r.delegation ?? r.group) as { id: number } | null | undefined;
        if (!rDelegation || rDelegation.id !== where.delegation.id) return false;
      }
      if (where.group?.id !== undefined) {
        const rGroup = r.group as { id: number } | null;
        if (!rGroup || rGroup.id !== where.group.id) return false;
      }
      return true;
    });
  }),
  findOne: vi.fn(async (options: { where: Row }) =>
    rows.find((r) => Object.entries(options.where).every(([k, v]) => r[k] === v)) ?? null,
  ),
  findOneBy: vi.fn(async (where: Row) =>
    rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null,
  ),
  create: vi.fn((input: Row) => ({ ...input })),
  save: vi.fn(async (input: Row) => input),
  remove: vi.fn(async () => undefined),
  update: vi.fn(async () => undefined),
});

const service = (repos: {
  transports?: Row[];
  assignments?: Row[];
  notes?: Row[];
  groups?: Row[];
  participants?: Row[];
  volunteers?: Row[];
  users?: Row[];
}) =>
  new DelegationsService(
    repo(repos.transports) as never,
    repo(repos.assignments) as never,
    repo(repos.notes) as never,
    repo(repos.groups ?? [group(LYON, 'Lyon'), group(ANNECY, 'Annecy')]) as never,
    repo(repos.participants) as never,
    repo(repos.volunteers ?? []) as never,
    repo(repos.users ?? []) as never,
  );

const all = { all: true } as const;
const lyonOnly = { all: false, groupIds: [LYON] } as const;

describe('DelegationsService — stats', () => {
  it('une exception reçue compte dans les totaux de l accueil, une sortante sort des totaux de l origine', async () => {
    const svc = service({
      participants: [
        participant(10, LYON, 'Camille', 'Roche'),
        participant(11, LYON, 'Hugo', 'Fabre'),
        participant(20, ANNECY, 'Léa', 'Fontaine'),
      ],
      assignments: [
        // Léa (Annecy) voyage avec Lyon : exception reçue par Lyon.
        assignment(1, 20, LYON, null),
        // Hugo (Lyon) voyage avec Annecy : exception sortante de Lyon.
        assignment(2, 11, ANNECY, null),
      ],
    });

    const stats = await svc.stats(LYON, all);
    const aller = stats.directions.find((d) => d.direction === TransportDirection.ALLER)!;
    // 2 membres - 1 sortant + 1 reçu = 2
    expect(aller.total).toBe(2);
    expect(aller.exceptionsReceived).toBe(1);
    expect(aller.exceptionsOutgoing).toBe(1);
    // À placer : Camille (sans ligne) + Léa (reçue non placée) ; Hugo est sortant.
    expect(aller.toPlace).toBe(2);

    const statsAnnecy = await svc.stats(ANNECY, all);
    const allerAnnecy = statsAnnecy.directions.find(
      (d) => d.direction === TransportDirection.ALLER,
    )!;
    // Côté Annecy : Léa est sortante (ne compte pas), Hugo est reçu (compte).
    expect(allerAnnecy.total).toBe(1);
    expect(allerAnnecy.exceptionsReceived).toBe(1);
    expect(allerAnnecy.exceptionsOutgoing).toBe(1);
  });
});

describe('DelegationsService — répartition', () => {
  it('l à placer réunit les membres sans affectation et les exceptions reçues non placées', async () => {
    const car = { ...transport(50, LYON), assignments: [] };
    const svc = service({
      transports: [car],
      participants: [
        participant(10, LYON, 'Camille', 'Roche'),
        participant(11, LYON, 'Hugo', 'Fabre'),
        participant(20, ANNECY, 'Léa', 'Fontaine'),
      ],
      assignments: [assignment(1, 20, LYON, 50)],
    });

    const view = await svc.repartition(LYON, TransportDirection.ALLER, all);
    // Camille et Hugo sans ligne ; Léa est placée dans le car (exception reçue placée).
    expect(view.toAssign.map((e) => e.person?.id).sort()).toEqual([10, 11]);
    expect(view.transports[0].occupancy).toBe(1);
    expect(view.transports[0].persons[0].person?.id).toBe(20);
    expect(view.exceptionsReceived).toHaveLength(1);
    expect(view.exceptionsOutgoing).toHaveLength(0);
  });
});

describe('DelegationsService — affectations', () => {
  it('une seule affectation par personne et par sens : la nouvelle déplace l ancienne', async () => {
    const existing = assignment(1, 10, LYON, 50);
    const assignmentsRepo = repo([existing]);
    const svc = new DelegationsService(
      repo([transport(50, LYON), transport(51, LYON)]) as never,
      assignmentsRepo as never,
      repo([]) as never,
      repo([group(LYON, 'Lyon')]) as never,
      repo([participant(10, LYON)]) as never,
      repo([]) as never,
      repo([]) as never,
    );

    const result = await svc.assign(51, { personType: AssignmentPersonType.PARTICIPANT, personId: 10 }, all);
    expect(result).toBe(existing);
    expect((result.transport as { id: number }).id).toBe(51);
    expect(assignmentsRepo.create).not.toHaveBeenCalled();
  });

  it('refuse l affectation d une personne sans délégation', async () => {
    const svc = service({
      transports: [transport(50, LYON)],
      participants: [participant(10, null)],
    });
    await expect(
      svc.assign(50, { personType: AssignmentPersonType.PARTICIPANT, personId: 10 }, all),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un responsable ne peut pas toucher au transport d une délégation hors périmètre', async () => {
    const svc = service({
      transports: [transport(50, ANNECY)],
      participants: [participant(10, LYON)],
    });
    await expect(
      svc.assign(50, { personType: AssignmentPersonType.PARTICIPANT, personId: 10 }, lyonOnly),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DelegationsService — exceptions', () => {
  it('créable des deux côtés : l accueil peut créer l exception entrante', async () => {
    const svc = service({
      participants: [participant(20, ANNECY, 'Léa', 'Fontaine')],
    });
    // Périmètre Lyon (accueil) uniquement, personne d'Annecy : accepté.
    const created = await svc.createException(
      LYON,
      {
        personType: AssignmentPersonType.PARTICIPANT,
        personId: 20,
        direction: TransportDirection.ALLER,
        toDelegationId: LYON,
      },
      lyonOnly,
    );
    expect((created.delegation as { id: number }).id).toBe(LYON);
    expect(created.transport).toBeNull();
  });

  it('refuse une exception vers la propre délégation de la personne', async () => {
    const svc = service({
      participants: [participant(20, ANNECY)],
    });
    await expect(
      svc.createException(
        ANNECY,
        {
          personType: AssignmentPersonType.PARTICIPANT,
          personId: 20,
          direction: TransportDirection.ALLER,
          toDelegationId: ANNECY,
        },
        all,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse une exception ni créée par l origine ni par l accueil', async () => {
    const svc = service({
      participants: [participant(20, ANNECY)],
    });
    await expect(
      svc.createException(
        LYON,
        {
          personType: AssignmentPersonType.PARTICIPANT,
          personId: 20,
          direction: TransportDirection.ALLER,
          toDelegationId: 3,
        },
        // Périmètre Lyon (créateur), personne d'Annecy, accueil 3 : ni origine ni accueil.
        { all: false, groupIds: [LYON] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('DelegationsService — notes', () => {
  const note = (
    id: number,
    personId: number,
    delegationId: number,
    parentId: number | null,
    createdAt: string,
  ) => ({
    id,
    personType: AssignmentPersonType.PARTICIPANT,
    personId,
    delegation: group(delegationId, `D${delegationId}`),
    authorName: 'S. Vivier',
    authorRole: 'COORDINATOR',
    parent: parentId ? ({ id: parentId } as never) : null,
    body: `note ${id}`,
    createdAt: new Date(createdAt),
  });

  it('un responsable ne voit pas les notes d une personne hors de sa délégation', async () => {
    const svc = service({
      participants: [participant(20, ANNECY)],
    });
    await expect(
      svc.listNotes(AssignmentPersonType.PARTICIPANT, 20, lyonOnly),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('le fil sans réponse ne garde que les personnes avec une note racine sans réponse', async () => {
    const svc = service({
      participants: [participant(10, LYON), participant(11, LYON)],
      notes: [
        note(1, 10, LYON, null, '2026-11-24T18:32:00Z'),
        note(2, 10, LYON, 1, '2026-11-25T09:14:00Z'), // réponse à la note 1
        note(3, 11, LYON, null, '2026-11-25T10:00:00Z'), // jamais répondue
      ],
    });
    const feed = await svc.notesFeed(lyonOnly, 'UNANSWERED');
    expect(feed).toHaveLength(1);
    expect(feed[0].person?.id).toBe(11);
    expect(feed[0].unansweredCount).toBe(1);
  });

  it('le fil d un responsable ne remonte que les notes de sa délégation', async () => {
    const svc = service({
      participants: [participant(10, LYON), participant(20, ANNECY)],
      notes: [note(1, 10, LYON, null, '2026-11-24T18:32:00Z'), note(2, 20, ANNECY, null, '2026-11-24T19:00:00Z')],
    });
    const feed = await svc.notesFeed(lyonOnly, 'ALL');
    expect(feed).toHaveLength(1);
    expect(feed[0].person?.id).toBe(10);
  });

  it('on répond à une note racine, pas à une réponse', async () => {
    const svc = service({
      participants: [participant(10, LYON)],
      notes: [note(2, 10, LYON, 1, '2026-11-25T09:14:00Z')],
    });
    await expect(
      svc.replyToNote(2, { body: 'réponse' }, { userId: 1, name: 'S. Vivier', role: null }, all),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('DelegationsService — fiche personne', () => {
  it('les trajets d un jeune remontent statut, délégation, exception et transport', async () => {
    const car = transport(50, ANNECY);
    const svc = service({
      transports: [car],
      participants: [participant(10, LYON, 'Camille', 'Roche')],
      assignments: [
        assignment(1, 10, ANNECY, 50), // aller : voyage avec Annecy (exception placée)
        assignment(2, 10, LYON, null, TransportDirection.RETOUR), // retour : à placer
      ],
    });

    const result = await svc.journeysForParticipantFiche(10, all);
    expect(result.personType).toBe(AssignmentPersonType.PARTICIPANT);
    expect(result.personId).toBe(10);
    const aller = result.journeys.find((j) => j.direction === TransportDirection.ALLER)!;
    expect(aller.status).toBe('PLACED');
    expect(aller.assignmentId).toBe(1);
    expect(aller.delegation.id).toBe(ANNECY);
    expect(aller.exception).toBe(true);
    expect(aller.transport?.name).toBe('Car 50');
    expect(aller.transport?.id).toBe(50);
    const retour = result.journeys.find((j) => j.direction === TransportDirection.RETOUR)!;
    expect(retour.status).toBe('TO_ASSIGN');
    expect(retour.assignmentId).toBe(2);
    expect(retour.transport).toBeNull();
  });

  it('une fiche BENEVOLE est résolue vers le bénévole de la projection', async () => {
    const ficheBenevole = {
      ...participant(30, LYON, 'Nora', 'Silva'),
      type: 'BENEVOLE',
      volunteer: { id: 7, firstName: 'Nora', lastName: 'Silva', team: 'Accueil', group: group(LYON, 'Lyon') },
    };
    const svc = service({
      participants: [ficheBenevole],
      volunteers: [ficheBenevole.volunteer],
      assignments: [
        { ...assignment(3, 7, LYON, 50), personType: AssignmentPersonType.VOLUNTEER },
      ],
      transports: [transport(50, LYON)],
    });

    const result = await svc.journeysForParticipantFiche(30, all);
    expect(result.personType).toBe(AssignmentPersonType.VOLUNTEER);
    expect(result.personId).toBe(7);
    expect(result.journeys).toHaveLength(1);
    expect(result.journeys[0].exception).toBe(false);
  });
});
