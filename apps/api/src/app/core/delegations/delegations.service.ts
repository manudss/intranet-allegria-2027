import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AccessScopeInfo } from '../auth/access-module.decorator';
import {
  AssignmentPersonType,
  DelegationTransport,
  Group,
  Participant,
  PersonNote,
  PersonType,
  TransportAssignment,
  TransportDirection,
  User,
  Volunteer,
} from '../entities';
import { CATALOGUE_DELEGATIONS } from '../../../database/seeds/delegations-catalog';
import {
  AssignTransportDto,
  CreateExceptionDto,
  CreateNoteDto,
  CreateTransportDto,
  NoteFeedFilter,
  ReplyNoteDto,
  UpdateTransportDto,
} from './delegations.types';

export interface PersonLite {
  personType: AssignmentPersonType;
  id: number;
  firstName: string;
  lastName: string;
  detail: string | null;
  delegationId: number | null;
}

export interface NoteAuthor {
  userId: number;
  name: string;
  role: string | null;
}

/** Ligne d'affectation dans une vue répartition (assignmentId null = pas encore de ligne). */
export interface AssignmentEntry {
  assignmentId: number | null;
  person: PersonLite | null;
  transportId: number | null;
  delegationId: number;
}

@Injectable()
export class DelegationsService {
  constructor(
    @InjectRepository(DelegationTransport)
    private readonly transportsRepository: Repository<DelegationTransport>,
    @InjectRepository(TransportAssignment)
    private readonly assignmentsRepository: Repository<TransportAssignment>,
    @InjectRepository(PersonNote)
    private readonly notesRepository: Repository<PersonNote>,
    @InjectRepository(Group)
    private readonly groupsRepository: Repository<Group>,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  private assertInScope(scope: AccessScopeInfo, delegationId: number) {
    if (!scope.all && !scope.groupIds.includes(delegationId)) {
      throw new NotFoundException(`Délégation ${delegationId} introuvable`);
    }
  }

  private async findDelegation(id: number, scope: AccessScopeInfo): Promise<Group> {
    this.assertInScope(scope, id);
    const group = await this.groupsRepository.findOneBy({ id });
    if (!group) throw new NotFoundException(`Délégation ${id} introuvable`);
    return group;
  }

  // ---------------------------------------------------------------- personnes

  private async getPerson(
    personType: AssignmentPersonType,
    personId: number,
  ): Promise<PersonLite> {
    if (personType === AssignmentPersonType.PARTICIPANT) {
      const participant = await this.participantsRepository.findOne({
        where: { id: personId },
        relations: { group: true },
      });
      if (!participant) throw new NotFoundException(`Participant ${personId} introuvable`);
      return {
        personType,
        id: participant.id,
        firstName: participant.firstName,
        lastName: participant.lastName,
        detail: participant.type,
        delegationId: participant.group?.id ?? null,
      };
    }
    const volunteer = await this.volunteersRepository.findOne({
      where: { id: personId },
      relations: { group: true },
    });
    if (!volunteer) throw new NotFoundException(`Bénévole ${personId} introuvable`);
    return {
      personType,
      id: volunteer.id,
      firstName: volunteer.firstName,
      lastName: volunteer.lastName,
      detail: volunteer.team,
      delegationId: volunteer.group?.id ?? null,
    };
  }

  private async listMembers(delegationId: number): Promise<PersonLite[]> {
    const participants = await this.participantsRepository.find({
      where: { group: { id: delegationId } },
      relations: { group: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    const volunteers = await this.volunteersRepository.find({
      where: { group: { id: delegationId } },
      relations: { group: true },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    return [
      ...participants.map((p) => ({
        personType: AssignmentPersonType.PARTICIPANT,
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        detail: p.type,
        delegationId: delegationId,
      })),
      ...volunteers.map((v) => ({
        personType: AssignmentPersonType.VOLUNTEER,
        id: v.id,
        firstName: v.firstName,
        lastName: v.lastName,
        detail: v.team,
        delegationId: delegationId,
      })),
    ];
  }

  private async personsByKeys(
    keys: { personType: AssignmentPersonType; personId: number }[],
  ): Promise<Map<string, PersonLite>> {
    const map = new Map<string, PersonLite>();
    const participantIds = keys
      .filter((k) => k.personType === AssignmentPersonType.PARTICIPANT)
      .map((k) => k.personId);
    const volunteerIds = keys
      .filter((k) => k.personType === AssignmentPersonType.VOLUNTEER)
      .map((k) => k.personId);
    if (participantIds.length > 0) {
      const participants = await this.participantsRepository.find({
        where: { id: In(participantIds) },
        relations: { group: true },
      });
      for (const p of participants) {
        map.set(`${AssignmentPersonType.PARTICIPANT}:${p.id}`, {
          personType: AssignmentPersonType.PARTICIPANT,
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          detail: p.type,
          delegationId: p.group?.id ?? null,
        });
      }
    }
    if (volunteerIds.length > 0) {
      const volunteers = await this.volunteersRepository.find({
        where: { id: In(volunteerIds) },
        relations: { group: true },
      });
      for (const v of volunteers) {
        map.set(`${AssignmentPersonType.VOLUNTEER}:${v.id}`, {
          personType: AssignmentPersonType.VOLUNTEER,
          id: v.id,
          firstName: v.firstName,
          lastName: v.lastName,
          detail: v.team,
          delegationId: v.group?.id ?? null,
        });
      }
    }
    return map;
  }

  // --------------------------------------------------------------- transports

  async listTransports(
    delegationId: number,
    direction: TransportDirection | undefined,
    scope: AccessScopeInfo,
  ) {
    await this.findDelegation(delegationId, scope);
    const transports = await this.transportsRepository.find({
      where: {
        delegation: { id: delegationId },
        ...(direction ? { direction } : {}),
      },
      relations: { assignments: true },
      order: { direction: 'ASC', departureDatetime: 'ASC', id: 'ASC' },
    });
    return transports.map((t) => ({
      id: t.id,
      delegationId,
      direction: t.direction,
      transportMode: t.transportMode,
      name: t.name,
      departureDatetime: t.departureDatetime,
      arrivalDatetime: t.arrivalDatetime,
      meetingPoint: t.meetingPoint,
      capacity: t.capacity,
      practicalInfo: t.practicalInfo,
      notes: t.notes,
      occupancy: t.assignments.length,
    }));
  }

  async createTransport(
    delegationId: number,
    dto: CreateTransportDto,
    scope: AccessScopeInfo,
  ): Promise<DelegationTransport> {
    await this.findDelegation(delegationId, scope);
    const transport = this.transportsRepository.create({
      delegation: { id: delegationId } as Group,
      direction: dto.direction,
      transportMode: dto.transportMode,
      name: dto.name,
      departureDatetime: dto.departureDatetime ? new Date(dto.departureDatetime) : null,
      arrivalDatetime: dto.arrivalDatetime ? new Date(dto.arrivalDatetime) : null,
      meetingPoint: dto.meetingPoint ?? null,
      capacity: dto.capacity ?? null,
      practicalInfo: dto.practicalInfo ?? null,
      notes: dto.notes ?? null,
    });
    return this.transportsRepository.save(transport);
  }

  private async findTransport(id: number): Promise<DelegationTransport> {
    const transport = await this.transportsRepository.findOne({
      where: { id },
      relations: { delegation: true },
    });
    if (!transport) throw new NotFoundException(`Transport ${id} introuvable`);
    return transport;
  }

  async updateTransport(
    id: number,
    dto: UpdateTransportDto,
    scope: AccessScopeInfo,
  ): Promise<DelegationTransport> {
    const transport = await this.findTransport(id);
    this.assertInScope(scope, transport.delegation.id);
    Object.assign(transport, {
      ...dto,
      departureDatetime:
        dto.departureDatetime !== undefined
          ? dto.departureDatetime
            ? new Date(dto.departureDatetime)
            : null
          : transport.departureDatetime,
      arrivalDatetime:
        dto.arrivalDatetime !== undefined
          ? dto.arrivalDatetime
            ? new Date(dto.arrivalDatetime)
            : null
          : transport.arrivalDatetime,
    });
    return this.transportsRepository.save(transport);
  }

  async removeTransport(id: number, scope: AccessScopeInfo): Promise<void> {
    const transport = await this.findTransport(id);
    this.assertInScope(scope, transport.delegation.id);
    // Les personnes placées retournent dans l'« à placer » (ON DELETE CASCADE sur
    // l'affectation ne convient pas : on déplace, on ne supprime pas la ligne).
    await this.assignmentsRepository.update(
      { transport: { id } },
      { transport: null },
    );
    await this.transportsRepository.remove(transport);
  }

  // ------------------------------------------------------------- affectations

  /** Affecte une personne à un transport ; une seule affectation par personne et par sens. */
  async assign(
    transportId: number,
    dto: AssignTransportDto,
    scope: AccessScopeInfo,
  ): Promise<TransportAssignment> {
    const transport = await this.findTransport(transportId);
    this.assertInScope(scope, transport.delegation.id);
    const person = await this.getPerson(dto.personType, dto.personId);
    if (!person.delegationId) {
      throw new BadRequestException(
        'La personne n\'est rattachée à aucune délégation : rattachement nécessaire avant affectation',
      );
    }
    if (transport.delegation.id === person.delegationId) {
      // Affectation interne : la délégation d'origine gère ses propres personnes.
      this.assertInScope(scope, person.delegationId);
    }
    const existing = await this.assignmentsRepository.findOne({
      where: {
        personType: dto.personType,
        personId: dto.personId,
        direction: transport.direction,
      },
    });
    if (existing) {
      existing.delegation = transport.delegation;
      existing.transport = transport;
      return this.assignmentsRepository.save(existing);
    }
    const assignment = this.assignmentsRepository.create({
      personType: dto.personType,
      personId: dto.personId,
      direction: transport.direction,
      delegation: transport.delegation,
      transport,
    });
    return this.assignmentsRepository.save(assignment);
  }

  /**
   * Crée une exception : la personne rejoint l'« à placer » d'une autre
   * délégation pour un sens. Créable des deux côtés (origine ou accueil).
   */
  async createException(
    delegationId: number,
    dto: CreateExceptionDto,
    scope: AccessScopeInfo,
  ): Promise<TransportAssignment> {
    await this.findDelegation(delegationId, scope);
    const person = await this.getPerson(dto.personType, dto.personId);
    if (!person.delegationId) {
      throw new BadRequestException('La personne n\'est rattachée à aucune délégation');
    }
    if (dto.toDelegationId === person.delegationId) {
      throw new BadRequestException(
        'La délégation d\'accueil est déjà la délégation de la personne : ce n\'est pas une exception',
      );
    }
    // Créable par l'origine ou par l'accueil : l'une des deux doit être dans le périmètre.
    const touchesScope = (id: number) => scope.all || scope.groupIds.includes(id);
    if (!touchesScope(person.delegationId) && !touchesScope(dto.toDelegationId)) {
      throw new ForbiddenException('Ni la délégation d\'origine ni celle d\'accueil n\'est dans votre périmètre');
    }
    await this.findDelegation(dto.toDelegationId, { all: true });
    const existing = await this.assignmentsRepository.findOne({
      where: {
        personType: dto.personType,
        personId: dto.personId,
        direction: dto.direction,
      },
    });
    if (existing) {
      existing.delegation = { id: dto.toDelegationId } as Group;
      existing.transport = null;
      return this.assignmentsRepository.save(existing);
    }
    const assignment = this.assignmentsRepository.create({
      personType: dto.personType,
      personId: dto.personId,
      direction: dto.direction,
      delegation: { id: dto.toDelegationId } as Group,
      transport: null,
    });
    return this.assignmentsRepository.save(assignment);
  }

  /** Retire une affectation : la personne retourne dans l'« à placer » de sa propre délégation. */
  async unassign(assignmentId: number, scope: AccessScopeInfo): Promise<void> {
    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
      relations: { delegation: true },
    });
    if (!assignment) throw new NotFoundException(`Affectation ${assignmentId} introuvable`);
    const person = await this.getPerson(assignment.personType, assignment.personId);
    const touchesScope = (id: number | null) =>
      id !== null && (scope.all || scope.groupIds.includes(id));
    if (!touchesScope(assignment.delegation.id) && !touchesScope(person.delegationId)) {
      throw new NotFoundException(`Affectation ${assignmentId} introuvable`);
    }
    await this.assignmentsRepository.remove(assignment);
  }

  /** Membres de la délégation (jeunes et bénévoles), dans le périmètre de l'appelant. */
  async persons(delegationId: number, scope: AccessScopeInfo): Promise<PersonLite[]> {
    await this.findDelegation(delegationId, scope);
    return this.listMembers(delegationId);
  }

  /**
   * Vue répartition d'une délégation pour un sens : file « à placer » (membres
   * sans affectation + exceptions reçues non placées), transports avec occupants,
   * exceptions reçues et sortantes.
   */
  async repartition(delegationId: number, direction: TransportDirection, scope: AccessScopeInfo) {
    await this.findDelegation(delegationId, scope);
    const members = await this.listMembers(delegationId);
    const memberKeys = new Set(members.map((m) => `${m.personType}:${m.id}`));

    const rows = await this.assignmentsRepository.find({
      where: { direction },
      relations: { delegation: true, transport: true },
    });
    const relevant = rows.filter(
      (r) =>
        r.delegation.id === delegationId || memberKeys.has(`${r.personType}:${r.personId}`),
    );
    const persons = await this.personsByKeys(
      relevant.map((r) => ({ personType: r.personType, personId: r.personId })),
    );
    const withPerson = (r: TransportAssignment): AssignmentEntry => ({
      assignmentId: r.id,
      person: persons.get(`${r.personType}:${r.personId}`) ?? null,
      transportId: r.transport?.id ?? null,
      delegationId: r.delegation.id,
    });

    const assignmentsByPerson = new Map(
      relevant.map((r) => [`${r.personType}:${r.personId}`, r]),
    );

    // « À placer » : membres sans ligne + exceptions reçues non placées.
    const toAssign: AssignmentEntry[] = [];
    for (const member of members) {
      if (!assignmentsByPerson.has(`${member.personType}:${member.id}`)) {
        toAssign.push({ assignmentId: null, person: member, transportId: null, delegationId });
      }
    }

    const exceptionsReceived: AssignmentEntry[] = [];
    const exceptionsOutgoing: AssignmentEntry[] = [];
    const placedByTransport = new Map<number, AssignmentEntry[]>();

    for (const row of relevant) {
      const key = `${row.personType}:${row.personId}`;
      const isMember = memberKeys.has(key);
      if (row.delegation.id === delegationId && !isMember) {
        const entry = withPerson(row);
        exceptionsReceived.push(entry);
        if (row.transport) {
          const list = placedByTransport.get(row.transport.id) ?? [];
          list.push(entry);
          placedByTransport.set(row.transport.id, list);
        } else {
          toAssign.push(entry);
        }
      } else if (row.delegation.id !== delegationId && isMember) {
        exceptionsOutgoing.push(withPerson(row));
      } else if (row.delegation.id === delegationId && isMember && row.transport) {
        const list = placedByTransport.get(row.transport.id) ?? [];
        list.push(withPerson(row));
        placedByTransport.set(row.transport.id, list);
      }
    }

    const transports = await this.transportsRepository.find({
      where: { delegation: { id: delegationId }, direction },
      order: { departureDatetime: 'ASC', id: 'ASC' },
    });

    return {
      delegationId,
      direction,
      toAssign,
      transports: transports.map((t) => {
        const placed = placedByTransport.get(t.id) ?? [];
        return {
          id: t.id,
          name: t.name,
          transportMode: t.transportMode,
          departureDatetime: t.departureDatetime,
          arrivalDatetime: t.arrivalDatetime,
          meetingPoint: t.meetingPoint,
          capacity: t.capacity,
          practicalInfo: t.practicalInfo,
          notes: t.notes,
          occupancy: placed.length,
          full: t.capacity !== null && placed.length >= t.capacity,
          persons: placed,
        };
      }),
      exceptionsReceived,
      exceptionsOutgoing,
    };
  }

  /**
   * Totaux par sens : une exception reçue compte dans les totaux de la
   * délégation d'accueil (et dans la jauge du véhicule une fois placée), une
   * exception sortante sort des totaux de sa délégation d'origine.
   */
  async stats(delegationId: number, scope: AccessScopeInfo) {
    await this.findDelegation(delegationId, scope);
    const members = await this.listMembers(delegationId);
    const memberKeys = new Set(members.map((m) => `${m.personType}:${m.id}`));
    const rows = await this.assignmentsRepository.find({ relations: { delegation: true } });
    const relevant = rows.filter(
      (r) => r.delegation.id === delegationId || memberKeys.has(`${r.personType}:${r.personId}`),
    );
    return {
      delegationId,
      directions: [
        this.summarizeDirection(members, relevant, delegationId, TransportDirection.ALLER),
        this.summarizeDirection(members, relevant, delegationId, TransportDirection.RETOUR),
      ],
    };
  }

  /**
   * Totaux d'un sens pour une délégation : une exception compte dans les totaux
   * de la délégation d'accueil (et dans la jauge du véhicule), pas dans ceux de
   * l'origine ; « à placer » = membres sans affectation + exceptions reçues non
   * placées. Partagé entre stats() et listSummaries().
   */
  private summarizeDirection(
    members: PersonLite[],
    relevant: TransportAssignment[],
    delegationId: number,
    direction: TransportDirection,
  ) {
    const memberKeys = new Set(members.map((m) => `${m.personType}:${m.id}`));
    const rowByPersonDirection = new Map(
      relevant.map((r) => [`${r.personType}:${r.personId}:${r.direction}`, r]),
    );
    let outgoing = 0;
    for (const member of members) {
      const row = rowByPersonDirection.get(`${member.personType}:${member.id}:${direction}`);
      if (row && row.delegation.id !== delegationId) outgoing += 1;
    }
    let received = 0;
    let receivedToPlace = 0;
    for (const row of relevant) {
      const key = `${row.personType}:${row.personId}`;
      if (
        row.direction === direction &&
        row.delegation.id === delegationId &&
        !memberKeys.has(key)
      ) {
        received += 1;
        if (!row.transport) receivedToPlace += 1;
      }
    }
    let toPlace = receivedToPlace;
    for (const member of members) {
      if (!rowByPersonDirection.has(`${member.personType}:${member.id}:${direction}`)) {
        toPlace += 1;
      }
    }
    return {
      direction,
      total: members.length - outgoing + received,
      members: members.length,
      exceptionsReceived: received,
      exceptionsOutgoing: outgoing,
      toPlace,
    };
  }

  /**
   * Synthèses pour la page cartes des délégations (lot 3 de la refonte) :
   * effectifs, répartition aller/retour, exceptions et responsables calculés en
   * une passe pour toutes les délégations visibles du périmètre, sans données
   * de santé. Les métadonnées zone/pays viennent du catalogue vérifié CEF.
   */
  async listSummaries(scope: AccessScopeInfo) {
    const groups = await this.groupsRepository.find({ order: { name: 'ASC' } });
    const visible = scope.all ? groups : groups.filter((g) => scope.groupIds.includes(g.id));
    const [participants, volunteers, assignments] = await Promise.all([
      this.participantsRepository.find({ relations: { group: true } }),
      this.volunteersRepository.find({ relations: { group: true } }),
      this.assignmentsRepository.find({ relations: { delegation: true } }),
    ]);

    const responsableRows: { group_id: number; firstName: string | null; lastName: string | null; email: string }[] =
      await this.groupsRepository.manager.query(
        'SELECT ugs.group_id, v."firstName", v."lastName", u.email FROM user_group_scopes ugs JOIN users u ON u.id = ugs.user_id AND u."isActive" LEFT JOIN volunteers v ON v.user_id = u.id ORDER BY v."lastName" ASC NULLS LAST, u.email ASC',
      );
    const responsablesByGroup = new Map<number, string[]>();
    for (const row of responsableRows) {
      const label =
        row.firstName && row.lastName
          ? `${row.firstName.charAt(0).toUpperCase()}. ${row.lastName}`
          : row.email;
      const list = responsablesByGroup.get(row.group_id) ?? [];
      list.push(label);
      responsablesByGroup.set(row.group_id, list);
    }

    const catalogByName = new Map(CATALOGUE_DELEGATIONS.map((e) => [e.name, e]));

    return visible.map((group) => {
      const groupParticipants = participants.filter((p) => p.group?.id === group.id);
      const groupVolunteers = volunteers.filter((v) => v.group?.id === group.id);
      const members: PersonLite[] = [
        ...groupParticipants.map((p) => ({
          personType: AssignmentPersonType.PARTICIPANT,
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          detail: p.type,
          delegationId: group.id,
        })),
        ...groupVolunteers.map((v) => ({
          personType: AssignmentPersonType.VOLUNTEER,
          id: v.id,
          firstName: v.firstName,
          lastName: v.lastName,
          detail: v.team,
          delegationId: group.id,
        })),
      ];
      const memberKeys = new Set(members.map((m) => `${m.personType}:${m.id}`));
      const relevant = assignments.filter(
        (r) => r.delegation.id === group.id || memberKeys.has(`${r.personType}:${r.personId}`),
      );
      const aller = this.summarizeDirection(members, relevant, group.id, TransportDirection.ALLER);
      const retour = this.summarizeDirection(members, relevant, group.id, TransportDirection.RETOUR);
      const catalog = catalogByName.get(group.name);
      return {
        id: group.id,
        name: group.name,
        diocese: group.diocese,
        zone: catalog?.zone ?? null,
        country: catalog?.country ?? null,
        jeunes: groupParticipants.filter((p) => p.type === PersonType.JEUNE).length,
        animateurs: groupParticipants.filter((p) => p.type === PersonType.ANIMATEUR).length,
        benevoles: groupVolunteers.length,
        total: members.length,
        aller: { total: aller.total, toPlace: aller.toPlace, placed: aller.total - aller.toPlace },
        retour: { total: retour.total, toPlace: retour.toPlace, placed: retour.total - retour.toPlace },
        toPlace: aller.toPlace + retour.toPlace,
        exceptionsReceived: aller.exceptionsReceived + retour.exceptionsReceived,
        exceptionsOutgoing: aller.exceptionsOutgoing + retour.exceptionsOutgoing,
        responsables: responsablesByGroup.get(group.id) ?? [],
      };
    });
  }

  /**
   * Trajets aller/retour pour la fiche personne de l'intranet : la fiche
   * BENEVOLE est une projection de bénévole, on résout d'abord la personne
   * réelle avant de lire ses affectations.
   */
  async journeysForParticipantFiche(participantFicheId: number, scope: AccessScopeInfo) {
    const fiche = await this.participantsRepository.findOne({
      where: { id: participantFicheId },
      relations: { group: true, volunteer: true },
    });
    if (!fiche) throw new NotFoundException(`Participant ${participantFicheId} introuvable`);
    const personType =
      fiche.type === PersonType.BENEVOLE && fiche.volunteer
        ? AssignmentPersonType.VOLUNTEER
        : AssignmentPersonType.PARTICIPANT;
    const personId = personType === AssignmentPersonType.VOLUNTEER ? fiche.volunteer!.id : fiche.id;
    const person = await this.getPerson(personType, personId);
    await this.assertPersonInScope(person, scope);
    const rows = await this.assignmentsRepository.find({
      where: { personType, personId },
      relations: { delegation: true, transport: true },
    });
    return {
      personType,
      personId,
      journeys: rows.map((r) => ({
        direction: r.direction,
        status: r.transport ? 'PLACED' : 'TO_ASSIGN',
        assignmentId: r.id,
        delegation: { id: r.delegation.id, name: r.delegation.name },
        exception: person.delegationId !== r.delegation.id,
        transport: r.transport
          ? {
              id: r.transport.id,
              name: r.transport.name,
              mode: r.transport.transportMode,
              departureDatetime: r.transport.departureDatetime,
              arrivalDatetime: r.transport.arrivalDatetime,
              meetingPoint: r.transport.meetingPoint,
            }
          : null,
      })),
    };
  }

  // --------------------------------------------------------------------- notes

  async resolveAuthor(userId: number, email: string, roles: string[]): Promise<NoteAuthor> {
    const volunteer = await this.volunteersRepository.findOne({
      where: { user: { id: userId } },
    });
    return {
      userId,
      name: volunteer ? `${volunteer.firstName} ${volunteer.lastName}` : email,
      role: roles.length > 0 ? roles.join(', ') : null,
    };
  }

  private async assertPersonInScope(person: PersonLite, scope: AccessScopeInfo) {
    if (scope.all) return;
    if (!person.delegationId || !scope.groupIds.includes(person.delegationId)) {
      throw new NotFoundException(`Personne introuvable dans votre périmètre`);
    }
  }

  async listNotes(
    personType: AssignmentPersonType,
    personId: number,
    scope: AccessScopeInfo,
  ): Promise<PersonNote[]> {
    const person = await this.getPerson(personType, personId);
    await this.assertPersonInScope(person, scope);
    return this.notesRepository.find({
      where: { personType, personId },
      relations: { parent: true },
      order: { createdAt: 'ASC' },
    });
  }

  async createNote(
    personType: AssignmentPersonType,
    personId: number,
    dto: CreateNoteDto,
    author: NoteAuthor,
    scope: AccessScopeInfo,
  ): Promise<PersonNote> {
    const person = await this.getPerson(personType, personId);
    await this.assertPersonInScope(person, scope);
    if (!person.delegationId) {
      throw new BadRequestException(
        'La personne n\'est rattachée à aucune délégation : rattachez-la avant de noter',
      );
    }
    const note = this.notesRepository.create({
      personType,
      personId,
      delegation: { id: person.delegationId } as Group,
      author: { id: author.userId } as User,
      authorName: author.name,
      authorRole: author.role,
      parent: null,
      body: dto.body,
    });
    return this.notesRepository.save(note);
  }

  async replyToNote(
    noteId: number,
    dto: ReplyNoteDto,
    author: NoteAuthor,
    scope: AccessScopeInfo,
  ): Promise<PersonNote> {
    const parent = await this.notesRepository.findOne({
      where: { id: noteId },
      relations: { delegation: true },
    });
    if (!parent) throw new NotFoundException(`Note ${noteId} introuvable`);
    if (parent.parent) {
      throw new BadRequestException('On répond à une note racine, pas à une réponse');
    }
    this.assertInScope(scope, parent.delegation.id);
    const reply = this.notesRepository.create({
      personType: parent.personType,
      personId: parent.personId,
      delegation: parent.delegation,
      author: { id: author.userId } as User,
      authorName: author.name,
      authorRole: author.role,
      parent,
      body: dto.body,
    });
    return this.notesRepository.save(reply);
  }

  /**
   * Fil de suivi des notes : une ligne par personne, avec son nombre de notes,
   * ses notes racine sans réponse et le dernier commentaire. Périmètre :
   * les notes de la délégation du lecteur uniquement.
   */
  async notesFeed(scope: AccessScopeInfo, filter: NoteFeedFilter = 'WITH_NOTES', q?: string) {
    // Filtrage en mémoire par périmètre : volumes faibles (notes de gestion).
    const allNotes = await this.notesRepository.find({
      relations: { delegation: true, parent: true },
      order: { createdAt: 'DESC' },
    });
    const notes = scope.all
      ? allNotes
      : allNotes.filter((n) => scope.groupIds.includes(n.delegation.id));

    const persons = await this.personsByKeys(
      notes.map((n) => ({ personType: n.personType, personId: n.personId })),
    );

    const byPerson = new Map<string, PersonNote[]>();
    for (const note of notes) {
      const key = `${note.personType}:${note.personId}`;
      const list = byPerson.get(key) ?? [];
      list.push(note);
      byPerson.set(key, list);
    }

    interface FeedRow {
      person: PersonLite | null;
      delegationId: number;
      notesCount: number;
      unansweredCount: number;
      lastNote: {
        id: number;
        body: string;
        authorName: string;
        authorRole: string | null;
        createdAt: Date;
      } | null;
    }
    let feed: FeedRow[] = [...byPerson.entries()].map(([key, personNotes]) => {
      const person = persons.get(key) ?? null;
      const roots = personNotes.filter((n) => !n.parent);
      const replies = personNotes.filter((n) => n.parent);
      const answeredRootIds = new Set(replies.map((r) => r.parent!.id));
      const unanswered = roots.filter((r) => !answeredRootIds.has(r.id));
      const last = personNotes[0];
      return {
        person,
        delegationId: last.delegation.id,
        notesCount: roots.length,
        unansweredCount: unanswered.length,
        lastNote: {
          id: last.id,
          body: last.body,
          authorName: last.authorName,
          authorRole: last.authorRole,
          createdAt: last.createdAt,
        },
      };
    });

    if (filter === 'ALL') {
      // Personnes du périmètre sans aucune note : lignes à zéro pour pouvoir écrire.
      const delegationIds = scope.all
        ? [...new Set(feed.map((f) => f.delegationId))]
        : scope.groupIds;
      const known = new Set(
        feed.map((f) => (f.person ? `${f.person.personType}:${f.person.id}` : '')),
      );
      for (const delegationId of delegationIds) {
        for (const member of await this.listMembers(delegationId)) {
          if (known.has(`${member.personType}:${member.id}`)) continue;
          feed.push({
            person: member,
            delegationId,
            notesCount: 0,
            unansweredCount: 0,
            lastNote: null,
          });
        }
      }
    }
    if (filter === 'WITH_NOTES') feed = feed.filter((f) => f.notesCount > 0);
    if (filter === 'UNANSWERED') feed = feed.filter((f) => f.unansweredCount > 0);
    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      feed = feed.filter((f) =>
        f.person
          ? `${f.person.firstName} ${f.person.lastName}`.toLowerCase().includes(needle)
          : false,
      );
    }
    feed.sort(
      (a, b) =>
        (b.lastNote ? new Date(b.lastNote.createdAt).getTime() : 0) -
        (a.lastNote ? new Date(a.lastNote.createdAt).getTime() : 0),
    );
    return feed;
  }
}
