import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AccommodationType,
  AssignmentStatus,
  GatheringCar,
  GatheringCarAssignment,
  GatheringCarPerson,
  GatheringCarPersonKind,
  GatheringCarStop,
  GatheringCarTarget,
  HostFamily,
  HostingGroup,
  Participant,
  ParticipantHostFamilyAssignment,
} from '../entities';
import {
  AddCarPersonDto,
  AssignTargetDto,
  CarStopDto,
  CreateCarDto,
  UpdateCarDto,
} from './gathering-transports.types';

export interface ServeTargetView {
  key: string;
  targetType: GatheringCarTarget;
  id: number;
  name: string;
  detail: string;
  personCount: number;
  assignmentId: number | null;
  carId: number | null;
  carName: string | null;
  /** null = pas encore renseigné, false = pas besoin de transport, true = à desservir. */
  needsTransport: boolean | null;
}

export interface FamilyChoiceView {
  id: number;
  name: string;
  groupId: number;
  groupName: string;
  personCount: number;
  /** null = suit le groupe ; true/false = choix propre prioritaire. */
  needsTransport: boolean | null;
  /** Famille qui se dessert à part (« nécessaire » alors que son groupe ne l'est pas). */
  separate: boolean;
}

export interface CarStopView {
  id: number;
  orderIndex: number;
  label: string;
  time: string | null;
}

export interface CarAssignmentView {
  id: number;
  targetType: GatheringCarTarget;
  targetId: number;
  name: string;
  personCount: number;
  /** Personnes de cette cible retirées du car en exception individuelle. */
  removedCount: number;
}

export interface CarPersonView {
  id: number;
  kind: GatheringCarPersonKind;
  participantId: number;
  firstName: string;
  lastName: string;
}

export interface CarView {
  id: number;
  name: string;
  capacity: number | null;
  serviceDates: string[] | null;
  notes: string | null;
  /** Personnes distinctes rattachées au car (exceptions comprises), sans répartition par date. */
  occupancy: number;
  stops: CarStopView[];
  assignments: CarAssignmentView[];
  persons: CarPersonView[];
}

export interface GatheringTransportsBoard {
  /** Cibles marquées « transport nécessaire » + toute cible déjà affectée à un car (jamais masquée). */
  targets: ServeTargetView[];
  /** Cibles dont le besoin n'est pas renseigné : à vérifier, sans présumer qu'elles ont besoin de transport. */
  undecidedTargets: ServeTargetView[];
  /** Nombre de cibles marquées « pas besoin de transport » (non listées). */
  notNeededCount: number;
  /** Cibles marquées « pas besoin » non affectées : listées pour pouvoir revenir sur le choix. */
  notNeededTargets: ServeTargetView[];
  /** Familles d'un groupe : choix propre (null = suit le groupe). */
  familyChoices: FamilyChoiceView[];
  cars: CarView[];
}

export interface TripOccupancy {
  /** null = comptage sur toute la période (aucune hypothèse de date). */
  date: string | null;
  count: number;
}

/**
 * Une famille d'un groupe est-elle comprise dans la cible de son groupe ? (choix validé par l'utilisateur)
 * - besoin non renseigné (null) : elle suit le groupe ;
 * - « pas besoin » explicite : elle n'est jamais comprise dans le groupe ;
 * - « nécessaire » explicite : comprise si le groupe est lui aussi « nécessaire », sinon cible séparée ;
 * - une famille déjà desservie à part (affectation propre) n'est jamais comptée une 2e fois dans son groupe.
 */
export const carriedByGroup = (
  familyNeed: boolean | null | undefined,
  groupNeed: boolean | null | undefined,
  hasOwnAssignment = false,
): boolean => {
  if (hasOwnAssignment) return false;
  if (familyNeed === false) return false;
  if (familyNeed === true && groupNeed !== true) return false;
  return true;
};

interface HousedLike {
  status: AssignmentStatus;
  arrivalDate?: string | null;
  departureDate?: string | null;
  participant: { id: number };
  hostFamily: { id: number; needsTransport?: boolean | null; hostingGroup?: { id: number; needsTransport?: boolean | null } | null };
}

/**
 * Occupation d'un car : personnes distinctes rattachées à ses cibles, exceptions REMOVED retirées et ADDED ajoutées.
 * Un voyageur relevant de deux cibles servies compte une fois, les logements annulés ne comptent pas.
 *
 * Aucun champ ne dit quelle personne prend quel trajet (le car n'a que des dates de service et des
 * exceptions sans date), donc par défaut on ne répartit pas par date : le total est un majorant fiable.
 * `filterByHousingDates` (hypothèse métier NON validée : « logé ce jour-là = prend le trajet ce jour-là »)
 * est prêt mais n'est utilisé par aucun appelant en production.
 */
export const computeTripOccupancy = (
  serviceDates: string[] | null,
  targets: { targetType: GatheringCarTarget; id: number }[],
  persons: { kind: GatheringCarPersonKind; participantId: number }[],
  housed: HousedLike[],
  filterByHousingDates = false,
  ownFamilyIds: Set<number> = new Set(),
): TripOccupancy[] => {
  const removed = new Set(persons.filter((p) => p.kind === GatheringCarPersonKind.REMOVED).map((p) => p.participantId));
  const added = persons.filter((p) => p.kind === GatheringCarPersonKind.ADDED).map((p) => p.participantId);
  const dates: (string | null)[] =
    filterByHousingDates && serviceDates && serviceDates.length ? [...serviceDates].sort() : [null];
  return dates.map((date) => {
    const ids = new Set<number>();
    for (const row of housed) {
      if (row.status === AssignmentStatus.CANCELLED) continue;
      if (date && row.arrivalDate && row.departureDate && (date < row.arrivalDate || date > row.departureDate)) continue;
      const served = targets.some((t) =>
        t.targetType === GatheringCarTarget.HOSTING_GROUP
          ? row.hostFamily.hostingGroup?.id === t.id &&
            carriedByGroup(row.hostFamily.needsTransport, row.hostFamily.hostingGroup?.needsTransport, ownFamilyIds.has(row.hostFamily.id))
          : row.hostFamily.id === t.id,
      );
      if (served) ids.add(row.participant.id);
    }
    for (const id of removed) ids.delete(id);
    for (const id of added) ids.add(id);
    return { date, count: ids.size };
  });
};

const targetKey = (targetType: GatheringCarTarget, id: number) => `${targetType}:${id}`;
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

@Injectable()
export class GatheringTransportsService {
  constructor(
    @InjectRepository(GatheringCar)
    private readonly carsRepository: Repository<GatheringCar>,
    @InjectRepository(GatheringCarStop)
    private readonly stopsRepository: Repository<GatheringCarStop>,
    @InjectRepository(GatheringCarAssignment)
    private readonly assignmentsRepository: Repository<GatheringCarAssignment>,
    @InjectRepository(GatheringCarPerson)
    private readonly personsRepository: Repository<GatheringCarPerson>,
    @InjectRepository(HostingGroup)
    private readonly hostingGroupsRepository: Repository<HostingGroup>,
    @InjectRepository(HostFamily)
    private readonly hostFamiliesRepository: Repository<HostFamily>,
    @InjectRepository(ParticipantHostFamilyAssignment)
    private readonly housedRepository: Repository<ParticipantHostFamilyAssignment>,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
  ) {}

  // ------------------------------------------------------- besoin de transport

  /** Marque le besoin de transport d'un groupe d'hébergement (null = remettre « non renseigné »). Ne touche à aucune affectation. */
  async setGroupTransportNeed(id: number, needsTransport: boolean | null): Promise<{ id: number; needsTransport: boolean | null }> {
    const group = await this.hostingGroupsRepository.findOneBy({ id });
    if (!group) throw new NotFoundException(`Groupe d'hébergement ${id} introuvable`);
    await this.hostingGroupsRepository.update({ id }, { needsTransport });
    return { id, needsTransport };
  }

  /** Marque le besoin de transport d'une famille / d'un hébergement. Ne touche à aucune affectation. */
  async setFamilyTransportNeed(id: number, needsTransport: boolean | null): Promise<{ id: number; needsTransport: boolean | null }> {
    const family = await this.hostFamiliesRepository.findOneBy({ id });
    if (!family) throw new NotFoundException(`Hébergement ${id} introuvable`);
    await this.hostFamiliesRepository.update({ id }, { needsTransport });
    return { id, needsTransport };
  }

  // ------------------------------------------------------------------- board

  async board(): Promise<GatheringTransportsBoard> {
    const [groups, families, cars, housed] = await Promise.all([
      this.hostingGroupsRepository.find({ relations: { hostFamilies: true } }),
      this.hostFamiliesRepository.find({ relations: { hostingGroup: true } }),
      this.carsRepository.find({
        relations: {
          stops: true,
          assignments: { hostingGroup: true, hostFamily: true },
          persons: { participant: true },
        },
      }),
      this.housedRepository.find({ relations: { hostFamily: { hostingGroup: true }, participant: true } }),
    ]);

    // Familles déjà desservies à part : jamais comptées une 2e fois dans leur groupe.
    const ownFamilyIds = new Set<number>();
    for (const car of cars) {
      for (const a of car.assignments) {
        if (a.targetType === GatheringCarTarget.HOST_FAMILY && a.hostFamily) ownFamilyIds.add(a.hostFamily.id);
      }
    }
    const carried = (row: (typeof housed)[number]) =>
      carriedByGroup(row.hostFamily.needsTransport, row.hostFamily.hostingGroup?.needsTransport, ownFamilyIds.has(row.hostFamily.id));

    // Effectifs logés (affectations non annulées), par groupe (familles comprises) et par hébergement.
    const countByGroup = new Map<number, number>();
    const countByFamily = new Map<number, number>();
    const excludedByGroup = new Map<number, number>();
    for (const row of housed) {
      if (row.status === AssignmentStatus.CANCELLED) continue;
      countByFamily.set(row.hostFamily.id, (countByFamily.get(row.hostFamily.id) ?? 0) + 1);
      const groupId = row.hostFamily.hostingGroup?.id;
      if (!groupId) continue;
      if (carried(row)) countByGroup.set(groupId, (countByGroup.get(groupId) ?? 0) + 1);
      else excludedByGroup.set(groupId, (excludedByGroup.get(groupId) ?? 0) + 1);
    }

    // Cibles d'hébergement de chaque participant logé (pour rattacher les retraits aux cibles).
    const targetsOfParticipant = new Map<number, { groupIds: Set<number>; familyIds: Set<number> }>();
    for (const row of housed) {
      if (row.status === AssignmentStatus.CANCELLED) continue;
      const entry = targetsOfParticipant.get(row.participant.id) ?? {
        groupIds: new Set<number>(),
        familyIds: new Set<number>(),
      };
      entry.familyIds.add(row.hostFamily.id);
      if (row.hostFamily.hostingGroup?.id && carried(row)) entry.groupIds.add(row.hostFamily.hostingGroup.id);
      targetsOfParticipant.set(row.participant.id, entry);
    }

    const assignmentByTarget = new Map<string, { assignment: GatheringCarAssignment; car: GatheringCar }>();
    for (const car of cars) {
      for (const a of car.assignments) {
        const id = a.targetType === GatheringCarTarget.HOSTING_GROUP ? a.hostingGroup?.id : a.hostFamily?.id;
        if (id !== undefined && id !== null) assignmentByTarget.set(targetKey(a.targetType, id), { assignment: a, car });
      }
    }

    const kindLabel = (kind: string) =>
      kind === 'ZONE' ? 'zone' : kind === 'PARISH' ? 'paroisse' : 'groupe';

    const targets: ServeTargetView[] = [];
    for (const group of groups) {
      const groupFamilies = families.filter((f) => f.hostingGroup?.id === group.id);
      const familyCount = groupFamilies.filter(
        (f) => f.accommodationType !== AccommodationType.COLLECTIVE,
      ).length;
      const collectiveCount = groupFamilies.length - familyCount;
      const parts: string[] = [];
      if (familyCount) parts.push(`${familyCount} ${plural(familyCount, 'famille d\'accueil', 'familles d\'accueil')}`);
      if (collectiveCount) parts.push(`${collectiveCount} ${plural(collectiveCount, 'hébergement collectif', 'hébergements collectifs')}`);
      const personCount = countByGroup.get(group.id) ?? 0;
      const excluded = excludedByGroup.get(group.id) ?? 0;
      const entry = assignmentByTarget.get(targetKey(GatheringCarTarget.HOSTING_GROUP, group.id));
      targets.push({
        key: targetKey(GatheringCarTarget.HOSTING_GROUP, group.id),
        targetType: GatheringCarTarget.HOSTING_GROUP,
        id: group.id,
        name: group.name,
        detail: `${parts.join(', ') || 'Aucun hébergement'} · ${personCount} ${plural(personCount, 'personne', 'personnes')} · ${kindLabel(group.kind)}${excluded ? ` · ${excluded} ${plural(excluded, 'personne gérée', 'personnes gérées')} à part` : ''}`,
        personCount,
        assignmentId: entry?.assignment.id ?? null,
        carId: entry?.car.id ?? null,
        carName: entry?.car.name ?? null,
        needsTransport: group.needsTransport ?? null,
      });
    }
    // Hébergements collectifs hors de tout groupe : desservis comme une cible propre.
    for (const family of families) {
      if (family.accommodationType !== AccommodationType.COLLECTIVE || family.hostingGroup) continue;
      const personCount = countByFamily.get(family.id) ?? 0;
      const entry = assignmentByTarget.get(targetKey(GatheringCarTarget.HOST_FAMILY, family.id));
      targets.push({
        key: targetKey(GatheringCarTarget.HOST_FAMILY, family.id),
        targetType: GatheringCarTarget.HOST_FAMILY,
        id: family.id,
        name: family.familyName,
        detail: `Hébergement collectif · ${family.city} · ${personCount} ${plural(personCount, 'personne', 'personnes')}`,
        personCount,
        assignmentId: entry?.assignment.id ?? null,
        carId: entry?.car.id ?? null,
        carName: entry?.car.name ?? null,
        needsTransport: family.needsTransport ?? null,
      });
    }
    // Familles d'un groupe avec un choix propre : cible séparée si elles se distinguent de leur groupe
    // (« nécessaire » alors que le groupe ne l'est pas), ou si elles sont déjà desservies à part (jamais masquées).
    for (const family of families) {
      if (!family.hostingGroup) continue;
      const entry = assignmentByTarget.get(targetKey(GatheringCarTarget.HOST_FAMILY, family.id));
      const groupNeed = groups.find((g) => g.id === family.hostingGroup!.id)?.needsTransport ?? null;
      const separate = family.needsTransport === true && groupNeed !== true;
      if (!separate && !entry) continue;
      const personCount = countByFamily.get(family.id) ?? 0;
      targets.push({
        key: targetKey(GatheringCarTarget.HOST_FAMILY, family.id),
        targetType: GatheringCarTarget.HOST_FAMILY,
        id: family.id,
        name: family.familyName,
        detail: `Famille du groupe ${family.hostingGroup.name ?? ''} · besoin propre · ${personCount} ${plural(personCount, 'personne', 'personnes')}`.replace('  ', ' '),
        personCount,
        assignmentId: entry?.assignment.id ?? null,
        carId: entry?.car.id ?? null,
        carName: entry?.car.name ?? null,
        needsTransport: family.needsTransport ?? null,
      });
    }
    // Une cible déjà affectée reste toujours visible ; sinon seul « transport nécessaire » est listé.
    const listed = targets.filter((t) => t.carId !== null || t.needsTransport === true);
    const undecidedTargets = targets.filter((t) => t.carId === null && t.needsTransport === null);
    const notNeededTargets = targets.filter((t) => t.carId === null && t.needsTransport === false);
    const notNeededCount = notNeededTargets.length;
    targets.length = 0;
    targets.push(...listed);
    targets.sort((a, b) => (a.carId ? 1 : 0) - (b.carId ? 1 : 0) || a.name.localeCompare(b.name, 'fr'));

    const carViews: CarView[] = cars.map((car) => {
      const removedIds = new Set(
        car.persons
          .filter((p) => p.kind === GatheringCarPersonKind.REMOVED)
          .map((p) => p.participant.id),
      );
      const removedIn = (groupId: number | null, familyId: number | null) =>
        [...removedIds].filter((pid) => {
          const t = targetsOfParticipant.get(pid);
          return t && ((groupId !== null && t.groupIds.has(groupId)) || (familyId !== null && t.familyIds.has(familyId)));
        }).length;
      const assignmentViews: CarAssignmentView[] = car.assignments
        .map((a) => {
          const isGroup = a.targetType === GatheringCarTarget.HOSTING_GROUP;
          const id = isGroup ? a.hostingGroup?.id : a.hostFamily?.id;
          if (id === undefined || id === null) return null;
          return {
            id: a.id,
            targetType: a.targetType,
            targetId: id,
            name: isGroup ? a.hostingGroup!.name : a.hostFamily!.familyName,
            personCount: isGroup ? countByGroup.get(id) ?? 0 : countByFamily.get(id) ?? 0,
            removedCount: removedIn(isGroup ? id : null, isGroup ? null : id),
          };
        })
        .filter((a): a is CarAssignmentView => a !== null)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      const persons: CarPersonView[] = car.persons.map((p) => ({
        id: p.id,
        kind: p.kind,
        participantId: p.participant.id,
        firstName: p.participant.firstName,
        lastName: p.participant.lastName,
      }));
      const trips = computeTripOccupancy(
        car.serviceDates,
        assignmentViews.map((a) => ({ targetType: a.targetType, id: a.targetId })),
        persons,
        housed,
      );
      const occupancy = trips[0]?.count ?? 0;
      return {
        id: car.id,
        name: car.name,
        capacity: car.capacity,
        serviceDates: car.serviceDates,
        notes: car.notes,
        occupancy,
        stops: [...car.stops].sort((a, b) => a.orderIndex - b.orderIndex),
        assignments: assignmentViews,
        persons,
      };
    });
    carViews.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    undecidedTargets.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const familyChoices: FamilyChoiceView[] = families
      .filter((f) => f.hostingGroup)
      .map((f) => {
        const group = groups.find((g) => g.id === f.hostingGroup!.id);
        return {
          id: f.id,
          name: f.familyName,
          groupId: f.hostingGroup!.id,
          groupName: group?.name ?? '',
          personCount: countByFamily.get(f.id) ?? 0,
          needsTransport: f.needsTransport ?? null,
          separate: f.needsTransport === true && (group?.needsTransport ?? null) !== true,
        };
      })
      .sort((a, b) => a.groupName.localeCompare(b.groupName, 'fr') || a.name.localeCompare(b.name, 'fr'));
    return { targets, undecidedTargets, notNeededCount, notNeededTargets, familyChoices, cars: carViews };
  }

  // -------------------------------------------------------------------- cars

  async createCar(dto: CreateCarDto): Promise<CarView> {
    const car = await this.carsRepository.save(
      this.carsRepository.create({
        name: dto.name,
        capacity: dto.capacity ?? null,
        serviceDates: dto.serviceDates ?? null,
        notes: dto.notes ?? null,
      }),
    );
    return this.carView(car.id);
  }

  async updateCar(id: number, dto: UpdateCarDto): Promise<CarView> {
    const car = await this.findCar(id);
    if (dto.name !== undefined) car.name = dto.name;
    if (dto.capacity !== undefined) car.capacity = dto.capacity;
    if (dto.serviceDates !== undefined) car.serviceDates = dto.serviceDates;
    if (dto.notes !== undefined) car.notes = dto.notes;
    await this.carsRepository.save(car);
    return this.carView(id);
  }

  async removeCar(id: number): Promise<void> {
    const car = await this.findCar(id);
    await this.carsRepository.remove(car);
  }

  async setStops(carId: number, stops: CarStopDto[]): Promise<CarView> {
    const car = await this.findCar(carId);
    await this.stopsRepository.delete({ car: { id: car.id } });
    if (stops.length) {
      await this.stopsRepository.save(
        stops.map((stop, index) =>
          this.stopsRepository.create({
            car,
            orderIndex: index,
            label: stop.label,
            time: stop.time ?? null,
          }),
        ),
      );
    }
    return this.carView(carId);
  }

  // ------------------------------------------------------------- affectations

  /** Affecte des cibles à un car : une cible déjà desservie ailleurs est déplacée. */
  /** Famille « nécessaire » dans un groupe qui ne l'est pas : elle devient une cible propre. */
  private async ownChoiceDiffers(family: HostFamily): Promise<boolean> {
    if (family.needsTransport !== true || !family.hostingGroup) return false;
    const group = await this.hostingGroupsRepository.findOneBy({ id: family.hostingGroup.id });
    return group?.needsTransport !== true;
  }

  /**
   * Affecte des cibles à un car. Règles validées par l'utilisateur :
   * - on bloque une affectation qui dépasse la capacité renseignée du car (sans capacité : pas de blocage) ;
   * - déplacer une cible déjà affectée à un autre car demande une confirmation explicite (confirmMove).
   * Rien n'est modifié si l'une des deux règles refuse.
   */
  async assign(carId: number, targets: AssignTargetDto[], confirmMove = false): Promise<CarView> {
    const car = await this.findCar(carId);
    const moved: string[] = [];
    const newTargets: AssignTargetDto[] = [];
    for (const target of targets) {
      const where =
        target.targetType === GatheringCarTarget.HOSTING_GROUP
          ? { hostingGroup: { id: target.id } }
          : { hostFamily: { id: target.id } };
      const current = await this.assignmentsRepository.findOne({
        where,
        relations: { car: true, hostingGroup: true, hostFamily: true },
      });
      if (current && current.car.id === car.id) continue;
      newTargets.push(target);
      if (current) moved.push(current.hostingGroup?.name ?? current.hostFamily?.familyName ?? `#${target.id}`);
    }
    if (moved.length && !confirmMove) {
      throw new ConflictException({
        code: 'CONFIRM_MOVE',
        message: `Déplacer vers « ${car.name} » : ${moved.join(', ')} est déjà affecté à un autre car. Confirmation requise.`,
        moved,
      });
    }
    if (car.capacity != null && newTargets.length) {
      const [housed, current] = await Promise.all([
        this.housedRepository.find({ relations: { hostFamily: { hostingGroup: true }, participant: true } }),
        this.carsRepository.findOne({
          where: { id: carId },
          relations: { assignments: { hostingGroup: true, hostFamily: true }, persons: { participant: true } },
        }),
      ]);
      const existing = (current?.assignments ?? [])
        .map((a) => ({
          targetType: a.targetType,
          id: (a.targetType === GatheringCarTarget.HOSTING_GROUP ? a.hostingGroup?.id : a.hostFamily?.id) as number,
        }))
        .filter((t) => t.id != null);
      const persons = (current?.persons ?? []).map((p) => ({ kind: p.kind, participantId: p.participant.id }));
      const allAssignments = await this.assignmentsRepository.find({ relations: { hostFamily: true } });
      const ownFamilyIds = new Set<number>(
        [
          ...allAssignments.filter((a) => a.targetType === GatheringCarTarget.HOST_FAMILY && a.hostFamily).map((a) => a.hostFamily!.id),
          ...newTargets.filter((t) => t.targetType === GatheringCarTarget.HOST_FAMILY).map((t) => t.id),
        ],
      );
      const trips = computeTripOccupancy(car.serviceDates, [...existing, ...newTargets], persons, housed, false, ownFamilyIds);
      const worst = trips.reduce((m, t) => (t.count > m.count ? t : m), trips[0]);
      if (worst.count > car.capacity) {
        throw new BadRequestException(
          `Capacité du car « ${car.name} » dépassée : ${worst.count} personnes pour ${car.capacity} places.`,
        );
      }
    }
    for (const target of targets) {
      const where =
        target.targetType === GatheringCarTarget.HOSTING_GROUP
          ? { hostingGroup: { id: target.id } }
          : { hostFamily: { id: target.id } };
      if (target.targetType === GatheringCarTarget.HOSTING_GROUP) {
        const group = await this.hostingGroupsRepository.findOneBy({ id: target.id });
        if (!group) throw new NotFoundException(`Groupe d'hébergement ${target.id} introuvable`);
      } else {
        const family = await this.hostFamiliesRepository.findOneBy({ id: target.id });
        if (!family) throw new NotFoundException(`Hébergement ${target.id} introuvable`);
        // Une famille déjà desservie à part reste déplaçable même si son groupe a depuis le même besoin.
        const alreadyOwn = family.hostingGroup
          ? (await this.assignmentsRepository.findOne({ where: { hostFamily: { id: family.id } }, relations: { car: true } })) !== null
          : false;
        const ownChoice = family.hostingGroup ? alreadyOwn || (await this.ownChoiceDiffers(family)) : false;
        const aloneCollective = family.accommodationType === AccommodationType.COLLECTIVE && !family.hostingGroup;
        if (!aloneCollective && !ownChoice) {
          throw new BadRequestException(
            'Une famille d\'un groupe se dessert avec son groupe, sauf si son besoin de transport est marqué à part.',
          );
        }
      }
      const existing = await this.assignmentsRepository.findOne({
        where,
        relations: { car: true },
      });
      if (existing && existing.car.id === car.id) continue;
      if (existing) await this.assignmentsRepository.remove(existing);
      await this.assignmentsRepository.save(
        this.assignmentsRepository.create({
          car,
          targetType: target.targetType,
          hostingGroup:
            target.targetType === GatheringCarTarget.HOSTING_GROUP ? ({ id: target.id } as HostingGroup) : null,
          hostFamily:
            target.targetType === GatheringCarTarget.HOST_FAMILY ? ({ id: target.id } as HostFamily) : null,
        }),
      );
    }
    return this.carView(carId);
  }

  async unassign(assignmentId: number): Promise<void> {
    const assignment = await this.assignmentsRepository.findOneBy({ id: assignmentId });
    if (!assignment) throw new NotFoundException(`Affectation ${assignmentId} introuvable`);
    await this.assignmentsRepository.remove(assignment);
  }

  // ----------------------------------------------------------------- personnes

  /** Exception individuelle : ADDED part avec le car, REMOVED ne part pas alors que son lieu est desservi. */
  async addPerson(carId: number, dto: AddCarPersonDto): Promise<CarView> {
    const car = await this.findCar(carId);
    const participant = await this.participantsRepository.findOneBy({ id: dto.participantId });
    if (!participant) throw new NotFoundException(`Participant ${dto.participantId} introuvable`);
    if (dto.kind === GatheringCarPersonKind.REMOVED) {
      const assignments = await this.assignmentsRepository.find({
        where: { car: { id: car.id } },
        relations: { hostingGroup: true, hostFamily: true },
      });
      const groupIds = new Set(
        assignments.filter((a) => a.hostingGroup).map((a) => a.hostingGroup!.id),
      );
      const familyIds = new Set(
        assignments.filter((a) => a.hostFamily).map((a) => a.hostFamily!.id),
      );
      const housedRows = await this.housedRepository.find({
        where: { participant: { id: participant.id } },
        relations: { hostFamily: { hostingGroup: true } },
      });
      const housedInTarget = housedRows.some(
        (row) =>
          row.status !== AssignmentStatus.CANCELLED &&
          (familyIds.has(row.hostFamily.id) ||
            (row.hostFamily.hostingGroup && groupIds.has(row.hostFamily.hostingGroup.id))),
      );
      if (!housedInTarget) {
        throw new BadRequestException(
          'Cette personne n\'est hébergée dans aucun lieu desservi par ce car : rien à retirer.',
        );
      }
    }
    if (dto.kind === GatheringCarPersonKind.ADDED && car.capacity != null) {
      const [housed, current, allAssignments] = await Promise.all([
        this.housedRepository.find({ relations: { hostFamily: { hostingGroup: true }, participant: true } }),
        this.carsRepository.findOne({
          where: { id: car.id },
          relations: { assignments: { hostingGroup: true, hostFamily: true }, persons: { participant: true } },
        }),
        this.assignmentsRepository.find({ relations: { hostFamily: true } }),
      ]);
      const targets = (current?.assignments ?? [])
        .map((a) => ({
          targetType: a.targetType,
          id: (a.targetType === GatheringCarTarget.HOSTING_GROUP ? a.hostingGroup?.id : a.hostFamily?.id) as number,
        }))
        .filter((t) => t.id != null);
      const persons = (current?.persons ?? [])
        .filter((p) => p.participant.id !== participant.id)
        .map((p) => ({ kind: p.kind, participantId: p.participant.id }));
      persons.push({ kind: GatheringCarPersonKind.ADDED, participantId: participant.id });
      const ownFamilyIds = new Set<number>(
        allAssignments.filter((a) => a.targetType === GatheringCarTarget.HOST_FAMILY && a.hostFamily).map((a) => a.hostFamily!.id),
      );
      const trips = computeTripOccupancy(car.serviceDates, targets, persons, housed, false, ownFamilyIds);
      const worst = trips.reduce((m, t) => (t.count > m.count ? t : m), trips[0]);
      if (worst.count > car.capacity) {
        throw new BadRequestException(
          `Capacité du car « ${car.name} » dépassée : ${worst.count} personnes pour ${car.capacity} places.`,
        );
      }
    }
    const existing = await this.personsRepository.findOne({
      where: { car: { id: car.id }, participant: { id: participant.id } },
    });
    if (existing) {
      existing.kind = dto.kind;
      await this.personsRepository.save(existing);
    } else {
      await this.personsRepository.save(
        this.personsRepository.create({ car, participant, kind: dto.kind }),
      );
    }
    return this.carView(carId);
  }

  async removePersonRow(personRowId: number): Promise<void> {
    const row = await this.personsRepository.findOneBy({ id: personRowId });
    if (!row) throw new NotFoundException(`Exception ${personRowId} introuvable`);
    await this.personsRepository.remove(row);
  }

  // ------------------------------------------------------------------ interne

  private async findCar(id: number): Promise<GatheringCar> {
    const car = await this.carsRepository.findOneBy({ id });
    if (!car) throw new NotFoundException(`Car ${id} introuvable`);
    return car;
  }

  private async carView(id: number): Promise<CarView> {
    const board = await this.board();
    const car = board.cars.find((c) => c.id === id);
    if (!car) throw new NotFoundException(`Car ${id} introuvable`);
    return car;
  }
}
