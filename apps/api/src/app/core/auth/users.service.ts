import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities';
import { CreateUserDto, UpdateUserDto } from './auth.types';
import { hashPassword } from './password.util';

export interface UserSearchParams {
  q?: string;
  role?: string;
  teamType?: string;
  teamId?: number;
  groupId?: number;
  limit?: number;
  offset?: number;
}

export interface UserSearchItem {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  roles: string[];
  teams: string[];
  teamTypes: string[];
}

export interface UserSearchResult {
  items: UserSearchItem[];
  total: number;
  hasMore: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create({
      email: dto.email.toLowerCase().trim(),
      passwordHash: hashPassword(dto.password),
      isActive: dto.isActive ?? true,
    });

    return this.usersRepository.save(user);
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * Recherche paginée pour les sélecteurs de personne. Aucun résultat sans texte (2 caractères
   * minimum) ni filtre : on ne renvoie jamais la liste complète. Les noms viennent de la fiche
   * bénévole liée au compte. Équipes et types : affectations en cours, équipes et types actifs
   * (même règle que les droits par type d'équipe).
   */
  async search(params: UserSearchParams): Promise<UserSearchResult> {
    const q = (params.q ?? '').trim();
    const hasFilter = Boolean(params.role || params.teamType || params.teamId || params.groupId);
    const limit = Math.min(Math.max(Math.trunc(params.limit ?? 10) || 10, 1), 20);
    const offset = Math.max(Math.trunc(params.offset ?? 0) || 0, 0);
    if (q.length < 2 && !hasFilter) return { items: [], total: 0, hasMore: false };

    const like = q.length >= 2 ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const current = `(m."startAt" IS NULL OR m."startAt" <= CURRENT_DATE)
          AND (m."endAt" IS NULL OR m."endAt" >= CURRENT_DATE)`;
    const rows: {
      id: number;
      email: string;
      isActive: boolean;
      firstName: string | null;
      lastName: string | null;
      total: string;
    }[] = await this.usersRepository.query(
      `SELECT u.id, u.email, u."isActive", v."firstName", v."lastName",
              COUNT(*) OVER () AS total
         FROM users u
         LEFT JOIN LATERAL (
           SELECT "firstName", "lastName" FROM volunteers WHERE user_id = u.id ORDER BY id LIMIT 1
         ) v ON true
        WHERE ($1::text IS NULL OR u.email ILIKE $1 ESCAPE '\\'
               OR EXISTS (SELECT 1 FROM volunteers x WHERE x.user_id = u.id AND (
                    x."firstName" ILIKE $1 ESCAPE '\\' OR x."lastName" ILIKE $1 ESCAPE '\\'
                    OR (x."firstName" || ' ' || x."lastName") ILIKE $1 ESCAPE '\\'
                    OR (x."lastName" || ' ' || x."firstName") ILIKE $1 ESCAPE '\\')))
          AND ($2::text IS NULL OR EXISTS (
                SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = u.id AND r.code = $2))
          AND ($3::text IS NULL OR EXISTS (
                SELECT 1 FROM volunteers x
                  JOIN volunteer_team_memberships m ON m.volunteer_id = x.id
                  JOIN volunteer_teams vt ON vt.id = m.volunteer_team_id AND vt."isActive" = true
                  JOIN volunteer_team_types tt ON tt.id = vt.type_id AND tt."isActive" = true
                 WHERE x.user_id = u.id AND tt.code = $3 AND ${current}))
          AND ($4::int IS NULL OR EXISTS (
                SELECT 1 FROM volunteers x
                  JOIN volunteer_team_memberships m ON m.volunteer_id = x.id
                  JOIN volunteer_teams vt ON vt.id = m.volunteer_team_id AND vt."isActive" = true
                 WHERE x.user_id = u.id AND vt.id = $4 AND ${current}))
          AND ($5::int IS NULL OR EXISTS (
                SELECT 1 FROM user_group_scopes g WHERE g.user_id = u.id AND g.group_id = $5))
        ORDER BY lower(u.email), u.id
        LIMIT $6 OFFSET $7`,
      [
        like,
        params.role ?? null,
        params.teamType ?? null,
        params.teamId ?? null,
        params.groupId ?? null,
        limit,
        offset,
      ],
    );
    const total = rows.length > 0 ? Number(rows[0].total) : 0;
    if (rows.length === 0) return { items: [], total, hasMore: false };

    const ids = rows.map((r) => Number(r.id));
    const roleRows: { user_id: number; code: string }[] = await this.usersRepository.query(
      `SELECT ur.user_id, r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = ANY($1::int[]) ORDER BY r.code`,
      [ids],
    );
    const teamRows: { user_id: number; name: string; type_label: string | null }[] =
      await this.usersRepository.query(
        `SELECT DISTINCT x.user_id, vt.name, tt.label AS type_label
           FROM volunteers x
           JOIN volunteer_team_memberships m ON m.volunteer_id = x.id
           JOIN volunteer_teams vt ON vt.id = m.volunteer_team_id AND vt."isActive" = true
           LEFT JOIN volunteer_team_types tt ON tt.id = vt.type_id AND tt."isActive" = true
          WHERE x.user_id = ANY($1::int[]) AND ${current}
          ORDER BY vt.name`,
        [ids],
      );
    const items: UserSearchItem[] = rows.map((r) => {
      const id = Number(r.id);
      const mine = teamRows.filter((t) => Number(t.user_id) === id);
      return {
        id,
        email: r.email,
        firstName: r.firstName ?? null,
        lastName: r.lastName ?? null,
        isActive: r.isActive,
        roles: roleRows.filter((x) => Number(x.user_id) === id).map((x) => x.code),
        teams: [...new Set(mine.map((t) => t.name))],
        teamTypes: [
          ...new Set(mine.map((t) => t.type_label).filter((l): l is string => Boolean(l))),
        ],
      };
    });
    return { items, total, hasMore: offset + items.length < total };
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException(`Utilisateur ${id} introuvable`);
    }

    return user;
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (Object.prototype.hasOwnProperty.call(dto, 'password') && dto.password) {
      user.passwordHash = hashPassword(dto.password);
    }

    if (
      Object.prototype.hasOwnProperty.call(dto, 'isActive') &&
      typeof dto.isActive === 'boolean'
    ) {
      user.isActive = dto.isActive;
    }

    return this.usersRepository.save(user);
  }
}
