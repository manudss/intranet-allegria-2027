import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Place, PlaceRoom, Volunteer, VolunteerTeam } from '../entities';
import type { GatheringScopeInfo } from '../auth/access-module.decorator';
import { CreatePlaceDto, ResolvedLocation, RoomDto, UpdatePlaceDto } from './places.types';
import { Grants, relationVisibility, roomDisplayName } from './places.rights';

/** Tables rattachées au lieu, avec la colonne texte historique de chacune. */
export const PLACE_LINKED_TABLES = ['program_sequences', 'volunteer_missions', 'volunteer_shifts', 'gathering_groups'] as const;

type Relation<T> = { visible: boolean; count?: number; items?: T[] };
const hidden = <T>(): Relation<T> => ({ visible: false });

@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(Place) private readonly places: Repository<Place>,
    @InjectRepository(PlaceRoom) private readonly rooms: Repository<PlaceRoom>,
    @InjectRepository(Volunteer) private readonly volunteers: Repository<Volunteer>,
    @InjectRepository(VolunteerTeam) private readonly teams: Repository<VolunteerTeam>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Liste (page Lieux, droit PLACES) : lieux, salles et compteurs de rattachements propres au lieu. */
  async list(query: { kind?: string; q?: string }, grants: Grants) {
    const qb = this.places.createQueryBuilder('p').leftJoinAndSelect('p.rooms', 'r').orderBy('p.name', 'ASC').addOrderBy('r.name', 'ASC');
    if (query.kind) qb.andWhere('p.kind = :kind', { kind: query.kind });
    if (query.q?.trim()) qb.andWhere('(p.name ILIKE :q OR p.address ILIKE :q OR p.city ILIKE :q)', { q: `%${query.q.trim()}%` });
    const rows = await qb.getMany();
    // Compteurs : seulement pour les modules visibles (absents sinon, jamais « 0 »).
    const vis = relationVisibility(grants);
    const counts = async (table: string): Promise<Map<number, number>> => {
      const r: { place_id: number; n: string }[] = await this.dataSource.query(
        `SELECT "place_id", count(*)::text AS n FROM "${table}" WHERE "place_id" IS NOT NULL GROUP BY "place_id"`,
      );
      return new Map(r.map((x) => [x.place_id, Number(x.n)]));
    };
    const ev = vis.events ? await counts('program_sequences') : null;
    const sh = vis.missions ? await counts('volunteer_shifts') : null;
    const gr = vis.groups === 'ALL' ? await counts('gathering_groups') : null;
    return rows.map((p) => ({
      ...this.toListItem(p),
      counts: {
        ...(ev ? { events: ev.get(p.id) ?? 0 } : {}),
        ...(sh ? { shifts: sh.get(p.id) ?? 0 } : {}),
        ...(gr ? { groups: gr.get(p.id) ?? 0 } : {}),
      },
    }));
  }

  private toListItem(p: Place) {
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      track: p.track,
      address: p.address,
      postalCode: p.postalCode,
      city: p.city,
      latitude: p.latitude,
      longitude: p.longitude,
      isActive: p.isActive,
      rooms: (p.rooms ?? []).map((r) => ({ id: r.id, name: r.name, displayName: roomDisplayName(p.name, r.name) })),
    };
  }

  /** Options du sélecteur : nom, type et salles seulement (ni adresse ni GPS). Actifs seulement. */
  async options() {
    const rows = await this.places.find({ where: { isActive: true }, relations: { rooms: true }, order: { name: 'ASC' } });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      rooms: (p.rooms ?? [])
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        .map((r) => ({ id: r.id, name: r.name, displayName: roomDisplayName(p.name, r.name) })),
    }));
  }

  private async getOrFail(id: number): Promise<Place> {
    const p = await this.places.findOne({ where: { id }, relations: { rooms: true } });
    if (!p) throw new NotFoundException('Lieu introuvable');
    return p;
  }

  /**
   * Résout le choix lieu + salle d'un objet rattaché. La salle DOIT appartenir au lieu (contrôle
   * serveur, doublé d'une clé étrangère composée). Lieu seul autorisé ; salle sans lieu refusée.
   * `text` est le libellé « Lieu · Salle » à écrire dans la colonne texte de l'objet.
   */
  async resolveLocation(placeId: number | null | undefined, roomId: number | null | undefined): Promise<ResolvedLocation> {
    if (placeId == null) {
      if (roomId != null) throw new BadRequestException('Une salle exige un lieu');
      return { placeId: null, roomId: null, text: null };
    }
    const place = await this.places.findOne({ where: { id: placeId } });
    if (!place) throw new BadRequestException('Lieu introuvable');
    if (roomId == null) return { placeId, roomId: null, text: place.name };
    const room = await this.rooms.findOne({ where: { id: roomId } });
    if (!room || room.placeId !== placeId) throw new BadRequestException('Cette salle n\'appartient pas au lieu choisi');
    return { placeId, roomId, text: roomDisplayName(place.name, room.name) };
  }

  private async normalizeResponsible(id: number | null | undefined): Promise<number | null | undefined> {
    if (id == null) return id;
    if (!(await this.volunteers.exists({ where: { id } }))) throw new BadRequestException('Bénévole responsable introuvable');
    return id;
  }

  private checkPosition(dto: { latitude?: number | null; longitude?: number | null }, current?: Place) {
    const lat = dto.latitude === undefined ? current?.latitude : dto.latitude;
    const lon = dto.longitude === undefined ? current?.longitude : dto.longitude;
    if ((lat == null) !== (lon == null)) throw new BadRequestException('Latitude et longitude vont ensemble');
  }

  private async assertNameFree(name: string, exceptId?: number) {
    const dup = await this.places
      .createQueryBuilder('p')
      .where('lower(p.name) = lower(:n)', { n: name.trim() })
      .andWhere(exceptId ? 'p.id <> :id' : '1=1', { id: exceptId })
      .getOne();
    if (dup) throw new ConflictException('Un lieu porte déjà ce nom');
  }

  async create(dto: CreatePlaceDto) {
    this.checkPosition(dto);
    await this.assertNameFree(dto.name);
    const responsible = await this.normalizeResponsible(dto.responsibleVolunteerId);
    const saved = await this.places.save(
      this.places.create({ ...dto, name: dto.name.trim(), responsibleVolunteerId: responsible ?? null }),
    );
    return this.toListItem(await this.getOrFail(saved.id));
  }

  async update(id: number, dto: UpdatePlaceDto) {
    const current = await this.getOrFail(id);
    this.checkPosition(dto, current);
    if (dto.name !== undefined) await this.assertNameFree(dto.name, id);
    const responsible = await this.normalizeResponsible(dto.responsibleVolunteerId);
    const { rooms: _rooms, ...rest } = current;
    void _rooms;
    const patch: Partial<Place> = { ...dto };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (responsible !== undefined) patch.responsibleVolunteerId = responsible;
    await this.places.save({ ...rest, ...patch, id });
    // Le libellé « Lieu · Salle » des objets rattachés suit le nom du lieu (jamais les textes non rattachés).
    if (patch.name && patch.name !== current.name) await this.refreshLinkedTexts(id);
    return this.toListItem(await this.getOrFail(id));
  }

  /** Recalcule le texte des seuls objets rattachés à ce lieu. Les textes libres non rattachés ne sont pas touchés. */
  private async refreshLinkedTexts(placeId: number) {
    for (const t of PLACE_LINKED_TABLES) {
      await this.dataSource.query(
        `UPDATE "${t}" x SET "location" = CASE WHEN x."room_id" IS NULL THEN p."name" ELSE p."name" || ' · ' || r."name" END
         FROM "places" p LEFT JOIN "place_rooms" r ON r."id" = x."room_id" WHERE x."place_id" = p."id" AND p."id" = $1`,
        [placeId],
      );
    }
  }

  /** Suppression refusée tant que des objets y sont rattachés ; sinon désactiver le lieu. */
  async remove(id: number) {
    await this.getOrFail(id);
    const used = await this.linkedCount('place_id', id);
    if (used > 0) throw new ConflictException(`Ce lieu est utilisé par ${used} élément(s) : désactivez-le plutôt.`);
    await this.places.delete(id);
    return { deleted: true };
  }

  private async linkedCount(col: 'place_id' | 'room_id', id: number): Promise<number> {
    let total = 0;
    for (const t of PLACE_LINKED_TABLES) {
      const r: { n: string }[] = await this.dataSource.query(`SELECT count(*)::text AS n FROM "${t}" WHERE "${col}" = $1`, [id]);
      total += Number(r[0]?.n ?? 0);
    }
    return total;
  }

  async addRoom(placeId: number, dto: RoomDto) {
    const place = await this.getOrFail(placeId);
    const name = dto.name.trim();
    if (place.rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())) throw new ConflictException('Cette salle existe déjà dans ce lieu');
    const room = await this.rooms.save(this.rooms.create({ placeId, name }));
    return { id: room.id, name: room.name, displayName: roomDisplayName(place.name, room.name) };
  }

  async renameRoom(placeId: number, roomId: number, dto: RoomDto) {
    const place = await this.getOrFail(placeId);
    const room = place.rooms.find((r) => r.id === roomId);
    if (!room) throw new NotFoundException('Salle introuvable dans ce lieu');
    const name = dto.name.trim();
    if (place.rooms.some((r) => r.id !== roomId && r.name.toLowerCase() === name.toLowerCase())) throw new ConflictException('Cette salle existe déjà dans ce lieu');
    await this.rooms.update({ id: roomId, placeId }, { name });
    await this.refreshLinkedTexts(placeId);
    return { id: roomId, name, displayName: roomDisplayName(place.name, name) };
  }

  async removeRoom(placeId: number, roomId: number) {
    const place = await this.getOrFail(placeId);
    if (!place.rooms.some((r) => r.id === roomId)) throw new NotFoundException('Salle introuvable dans ce lieu');
    const used = await this.linkedCount('room_id', roomId);
    if (used > 0) throw new ConflictException(`Cette salle est utilisée par ${used} élément(s) : retirez-la d'abord.`);
    await this.rooms.delete({ id: roomId, placeId });
    return { deleted: true };
  }

  async setTeams(placeId: number, volunteerTeamIds: number[]) {
    await this.getOrFail(placeId);
    const ids = [...new Set(volunteerTeamIds)];
    if (ids.length) {
      const found = await this.teams.createQueryBuilder('t').where('t.id IN (:...ids)', { ids }).getCount();
      if (found !== ids.length) throw new BadRequestException('Équipe introuvable');
    }
    await this.dataSource.transaction(async (m) => {
      await m.query(`DELETE FROM "place_volunteer_teams" WHERE "place_id" = $1`, [placeId]);
      for (const tid of ids) await m.query(`INSERT INTO "place_volunteer_teams" ("place_id","volunteer_team_id") VALUES ($1,$2)`, [placeId, tid]);
    });
    return { volunteerTeamIds: ids };
  }

  /**
   * Fiche complète : infos du lieu + relations. Chaque relation n'apparaît que si la personne a le
   * droit sur son module source, et seulement avec les objets qu'elle y voit (compteurs compris).
   */
  async fiche(id: number, grants: Grants, gatheringScope: GatheringScopeInfo, userGroupIds: number[] = []) {
    const place = await this.getOrFail(id);
    const vis = relationVisibility(grants);
    const q = <T>(sql: string, params: unknown[]) => this.dataSource.query(sql, params) as Promise<T[]>;

    const events: Relation<unknown> = vis.events
      ? await (async () => {
          const items = await q<{ id: number; title: string; eventDate: string; startTime: string; endTime: string; room: string | null }>(
            `SELECT s."id", s."title", s."eventDate"::text AS "eventDate", s."startTime"::text AS "startTime", s."endTime"::text AS "endTime", r."name" AS room
             FROM "program_sequences" s LEFT JOIN "place_rooms" r ON r."id" = s."room_id" WHERE s."place_id" = $1 ORDER BY s."eventDate", s."startTime"`,
            [id],
          );
          return { visible: true, count: items.length, items };
        })()
      : hidden();

    const missions: Relation<unknown> & { shifts?: Relation<unknown> } = vis.missions
      ? await (async () => {
          const items = await q<{ id: number; title: string; room: string | null }>(
            `SELECT m."id", m."title", r."name" AS room FROM "volunteer_missions" m LEFT JOIN "place_rooms" r ON r."id" = m."room_id" WHERE m."place_id" = $1 ORDER BY m."title"`,
            [id],
          );
          return { visible: true, count: items.length, items };
        })()
      : hidden();
    const shifts: Relation<unknown> = vis.missions
      ? await (async () => {
          const items = await q<{ id: number; missionId: number; missionTitle: string; startAt: string; endAt: string; room: string | null }>(
            `SELECT s."id", s."missionId", m."title" AS "missionTitle", s."startAt"::text AS "startAt", s."endAt"::text AS "endAt", r."name" AS room
             FROM "volunteer_shifts" s JOIN "volunteer_missions" m ON m."id" = s."missionId" LEFT JOIN "place_rooms" r ON r."id" = s."room_id"
             WHERE s."place_id" = $1 ORDER BY s."startAt"`,
            [id],
          );
          return { visible: true, count: items.length, items };
        })()
      : hidden();

    let groups: Relation<unknown> = hidden();
    if (vis.groups) {
      const allowed = vis.groups === 'ALL' || gatheringScope.all ? null : gatheringScope.gatheringGroupIds.length ? gatheringScope.gatheringGroupIds : userGroupIds;
      const items = await q<{ id: number; name: string; room: string | null }>(
        `SELECT g."id", g."name", r."name" AS room FROM "gathering_groups" g LEFT JOIN "place_rooms" r ON r."id" = g."room_id"
         WHERE g."place_id" = $1 AND ($2::int[] IS NULL OR g."id" = ANY($2::int[])) ORDER BY g."name"`,
        [id, allowed],
      );
      groups = { visible: true, count: items.length, items };
    }

    const teams: Relation<unknown> = vis.teams
      ? await (async () => {
          const items = await q<{ id: number; name: string; code: string }>(
            `SELECT t."id", t."name", t."code" FROM "place_volunteer_teams" l JOIN "volunteer_teams" t ON t."id" = l."volunteer_team_id" WHERE l."place_id" = $1 ORDER BY t."name"`,
            [id],
          );
          return { visible: true, count: items.length, items };
        })()
      : hidden();

    let responsible: { id: number; name: string } | null | undefined;
    if (vis.responsible && place.responsibleVolunteerId != null) {
      const v = await this.volunteers.findOne({ where: { id: place.responsibleVolunteerId } });
      responsible = v ? { id: v.id, name: `${v.firstName} ${v.lastName}` } : null;
    }

    return {
      ...this.toListItem(place),
      description: place.description,
      practicalInfo: place.practicalInfo,
      country: place.country,
      responsible: vis.responsible ? (responsible ?? null) : undefined,
      relations: { events, missions, shifts, groups, teams },
    };
  }

  /** Textes libres existants (non rattachés) avec leur nombre, pour l'écran « À rattacher ». Lecture seule. */
  async unlinkedTexts(grants: Grants) {
    const out: { source: string; text: string; count: number }[] = [];
    const vis = relationVisibility(grants);
    // Chaque source suit le droit de son module : pas de texte ni de compteur d'un module non visible.
    const allowed: Record<string, boolean> = {
      program_sequences: vis.events,
      volunteer_missions: vis.missions,
      volunteer_shifts: vis.missions,
      gathering_groups: vis.groups === 'ALL',
    };
    for (const t of PLACE_LINKED_TABLES) {
      if (!allowed[t]) continue;
      const rows: { text: string; n: string }[] = await this.dataSource.query(
        `SELECT "location" AS text, count(*)::text AS n FROM "${t}" WHERE "place_id" IS NULL AND "location" IS NOT NULL AND btrim("location") <> '' GROUP BY "location" ORDER BY count(*) DESC, "location"`,
      );
      for (const r of rows) out.push({ source: t, text: r.text, count: Number(r.n) });
    }
    return out;
  }
}
