import { NotFoundException, BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ACCESS_MODULE_CODES,
  ACCESS_SUBJECT_KINDS,
  AccessLevel,
  AccessScope,
  AccessSubjectKind,
  LEVEL_RANK,
  SCOPE_RANK,
  isAccessLevel,
  isAccessScope,
} from './access-modules';

export type EffectiveGrant = {
  module: string;
  level: AccessLevel;
  scope: AccessScope;
  /**
   * Couples niveau/portée conservés tels que définis (jamais croisés) : Voir/Tout + Modifier/Groupes
   * donne « voir tout » et « modifier dans ses groupes », pas « modifier tout ». Les couples
   * dominés (niveau et portée tous deux inférieurs ou égaux à un autre couple) sont retirés.
   * `level` et `scope` ci-dessus décrivent le couple de niveau le plus haut (affichage seulement).
   */
  pairs: { level: AccessLevel; scope: AccessScope }[];
  /** D'où vient le droit (pour « Voir comme ») : "ROLE:ADMIN", "TEAM_TYPE:SECURITE", "OVERRIDE:3". */
  sources: string[];
};

export type RuleInput = {
  subjectKind: string;
  subjectKey: string;
  module: string;
  /** null = retirer la règle (aucun accès). */
  level: string | null;
  scope?: string;
};

type Actor = { id: number; email: string } | null;

const CACHE_TTL_MS = 15_000;

@Injectable()
export class AccessRightsService {
  private cache = new Map<string, { at: number; value: Record<string, EffectiveGrant> }>();

  constructor(private readonly dataSource: DataSource) {}

  invalidate(): void {
    this.cache.clear();
  }

  /** Codes des types d'équipes actifs auxquels la personne appartient aujourd'hui (équipe et type actifs). */
  async teamTypeCodesForUser(userId: number): Promise<string[]> {
    const rows: { code: string }[] = await this.dataSource.query(
      `SELECT DISTINCT t.code
         FROM volunteers v
         JOIN volunteer_team_memberships m ON m.volunteer_id = v.id
         JOIN volunteer_teams vt ON vt.id = m.volunteer_team_id AND vt."isActive" = true
         JOIN volunteer_team_types t ON t.id = vt.type_id AND t."isActive" = true
        WHERE v.user_id = $1
          AND (m."startAt" IS NULL OR m."startAt" <= CURRENT_DATE)
          AND (m."endAt" IS NULL OR m."endAt" >= CURRENT_DATE)`,
      [userId],
    );
    return rows.map((r) => r.code);
  }

  async effective(userId: number, roles: string[]): Promise<Record<string, EffectiveGrant>> {
    const key = `${userId}|${[...roles].sort().join(',')}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

    const typeCodes = await this.teamTypeCodesForUser(userId);
    const rules: {
      subject_kind: string;
      subject_key: string;
      module: string;
      level: AccessLevel;
      scope: AccessScope;
    }[] = await this.dataSource.query(
      `SELECT subject_kind, subject_key, module, level, scope FROM access_rules
          WHERE (subject_kind = 'ROLE' AND subject_key = ANY($1))
             OR (subject_kind = 'TEAM_TYPE' AND subject_key = ANY($2))`,
      [roles, typeCodes],
    );
    const overrides: { id: number; module: string; level: AccessLevel; scope: AccessScope }[] =
      await this.dataSource.query(
        `SELECT id, module, level, scope FROM access_overrides
          WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > now())`,
        [userId],
      );

    const result: Record<string, EffectiveGrant> = {};
    const add = (module: string, level: AccessLevel, scope: AccessScope, source: string) => {
      const current = result[module];
      if (!current) {
        result[module] = { module, level, scope, pairs: [{ level, scope }], sources: [source] };
        return;
      }
      current.sources.push(source);
      const dominated = current.pairs.some(
        (p) => LEVEL_RANK[p.level] >= LEVEL_RANK[level] && SCOPE_RANK[p.scope] >= SCOPE_RANK[scope],
      );
      if (dominated) return;
      current.pairs = current.pairs.filter(
        (p) =>
          !(LEVEL_RANK[level] >= LEVEL_RANK[p.level] && SCOPE_RANK[scope] >= SCOPE_RANK[p.scope]),
      );
      current.pairs.push({ level, scope });
      const top = [...current.pairs].sort(
        (a, b) =>
          LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope],
      )[0];
      current.level = top.level;
      current.scope = top.scope;
    };
    for (const r of rules) add(r.module, r.level, r.scope, `${r.subject_kind}:${r.subject_key}`);
    for (const o of overrides) add(o.module, o.level, o.scope, `OVERRIDE:${o.id}`);

    this.cache.set(key, { at: Date.now(), value: result });
    return result;
  }

  /** Vrai si la portée couvre ce groupe (portée « tout » ou groupe dans la liste). */
  static groupInScope(
    scope: { all: boolean; groupIds?: number[] },
    groupId: number | null | undefined,
  ) {
    if (scope.all) return true;
    return groupId != null && (scope.groupIds ?? []).includes(groupId);
  }

  /** Refuse (404, pour ne rien révéler) si le participant est hors de la portée. */
  async assertParticipantInScope(
    scope: { all: boolean; groupIds?: number[] },
    participantId: number,
  ) {
    if (scope.all) return;
    const rows: { group_id: number | null }[] = await this.dataSource.query(
      `SELECT group_id FROM participants WHERE id = $1`,
      [participantId],
    );
    if (!rows.length || !AccessRightsService.groupInScope(scope, rows[0].group_id)) {
      throw new NotFoundException(`Participant ${participantId} introuvable`);
    }
  }

  /** Ids (parmi ceux fournis) dont le participant est dans un groupe de la portée. */
  async participantIdsInScope(
    scope: { all: boolean; groupIds?: number[] },
    ids: (number | null | undefined)[],
  ): Promise<Set<number>> {
    const wanted = [...new Set(ids.filter((i): i is number => typeof i === 'number'))];
    if (scope.all) return new Set(wanted);
    if (!wanted.length || !(scope.groupIds ?? []).length) return new Set();
    const rows: { id: number }[] = await this.dataSource.query(
      `SELECT id FROM participants WHERE id = ANY($1::int[]) AND group_id = ANY($2::int[])`,
      [wanted, scope.groupIds],
    );
    return new Set(rows.map((r) => r.id));
  }

  /**
   * Bénévoles visibles pour les portées « soi-même » et « son équipe ».
   * Seul le lien volunteers.user_id posé à la main en admin est utilisé : aucun rapprochement
   * par e-mail ou par nom. Sans lien, la personne ne voit rien.
   * « Son équipe » = sa fiche + les bénévoles des équipes bénévoles dont sa fiche est membre
   * (dates de début et de fin des affectations non prises en compte).
   */
  async volunteerIdsForScopes(
    userId: number,
    scopes: ('SELF' | 'OWN_TEAM')[],
  ): Promise<number[]> {
    const own: { id: number }[] = await this.dataSource.query(
      `SELECT id FROM volunteers WHERE user_id = $1`,
      [userId],
    );
    const ownIds = own.map((r) => r.id);
    const ids = new Set<number>(ownIds);
    if (scopes.includes('OWN_TEAM') && ownIds.length) {
      const mates: { volunteer_id: number }[] = await this.dataSource.query(
        `SELECT DISTINCT m2.volunteer_id
           FROM volunteer_team_memberships m1
           JOIN volunteer_team_memberships m2 ON m2.volunteer_team_id = m1.volunteer_team_id
          WHERE m1.volunteer_id = ANY($1::int[])`,
        [ownIds],
      );
      for (const r of mates) ids.add(r.volunteer_id);
    }
    return [...ids].sort((a, b) => a - b);
  }

  async groupIdsForUser(userId: number): Promise<number[]> {
    const rows: { group_id: number }[] = await this.dataSource.query(
      `SELECT group_id FROM user_group_scopes WHERE user_id = $1 ORDER BY group_id`,
      [userId],
    );
    return rows.map((r) => r.group_id);
  }

  /** Droits d'une personne (pour « Voir comme » et /access/me). */
  async describeUser(userId: number) {
    const [user]: { id: number; email: string }[] = await this.dataSource.query(
      `SELECT id, email FROM users WHERE id = $1`,
      [userId],
    );
    if (!user) return null;
    const roleRows: { code: string }[] = await this.dataSource.query(
      `SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1 ORDER BY r.code`,
      [userId],
    );
    const roles = roleRows.map((r) => r.code);
    const effective = await this.effective(userId, roles);
    return {
      user,
      roles,
      teamTypes: await this.teamTypeCodesForUser(userId),
      groupIds: await this.groupIdsForUser(userId),
      grants: Object.values(effective),
    };
  }

  // ---- Administration -------------------------------------------------

  listRules() {
    return this.dataSource.query(
      `SELECT id, subject_kind AS "subjectKind", subject_key AS "subjectKey", module, level, scope
         FROM access_rules ORDER BY subject_kind, subject_key, module`,
    );
  }

  async subjects() {
    const roles = await this.dataSource.query(`SELECT code, label FROM roles ORDER BY code`);
    const types = await this.dataSource.query(
      `SELECT code, label, "isActive" FROM volunteer_team_types ORDER BY "sortOrder", label`,
    );
    return {
      roles: roles as { code: string; label: string }[],
      teamTypes: types as { code: string; label: string; isActive: boolean }[],
    };
  }

  /** Enregistre un lot de cases de la matrice. Tout ou rien, journalisé. */
  async saveRules(inputs: RuleInput[], actor: Actor) {
    if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > 1000) {
      throw new BadRequestException('Liste de règles invalide (1 à 1000).');
    }
    const subjects = await this.subjects();
    const validRoles = new Set(subjects.roles.map((r) => r.code));
    const validTypes = new Set(subjects.teamTypes.map((t) => t.code));
    for (const input of inputs) {
      if (!(ACCESS_SUBJECT_KINDS as readonly string[]).includes(input.subjectKind)) {
        throw new BadRequestException(`Sujet inconnu : ${input.subjectKind}`);
      }
      const known = input.subjectKind === 'ROLE' ? validRoles : validTypes;
      if (!known.has(input.subjectKey)) {
        throw new BadRequestException(`${input.subjectKind} inconnu : ${input.subjectKey}`);
      }
      if (!ACCESS_MODULE_CODES.includes(input.module)) {
        throw new BadRequestException(`Module inconnu : ${input.module}`);
      }
      if (input.level !== null && !isAccessLevel(input.level)) {
        throw new BadRequestException(`Niveau invalide : ${input.level}`);
      }
      if (input.scope !== undefined && !isAccessScope(input.scope)) {
        throw new BadRequestException(`Portée invalide : ${input.scope}`);
      }
    }
    const changes: unknown[] = [];
    await this.dataSource.transaction(async (manager) => {
      for (const input of inputs) {
        const [before] = await manager.query(
          `SELECT level, scope FROM access_rules WHERE subject_kind = $1 AND subject_key = $2 AND module = $3`,
          [input.subjectKind, input.subjectKey, input.module],
        );
        if (input.level === null) {
          await manager.query(
            `DELETE FROM access_rules WHERE subject_kind = $1 AND subject_key = $2 AND module = $3`,
            [input.subjectKind, input.subjectKey, input.module],
          );
        } else {
          await manager.query(
            `INSERT INTO access_rules (subject_kind, subject_key, module, level, scope)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (subject_kind, subject_key, module)
             DO UPDATE SET level = EXCLUDED.level, scope = EXCLUDED.scope, "updatedAt" = now()`,
            [input.subjectKind, input.subjectKey, input.module, input.level, input.scope ?? 'ALL'],
          );
        }
        const after =
          input.level === null ? null : { level: input.level, scope: input.scope ?? 'ALL' };
        if (JSON.stringify(before ?? null) !== JSON.stringify(after)) {
          changes.push({
            subject: `${input.subjectKind}:${input.subjectKey}`,
            module: input.module,
            before: before ?? null,
            after,
          });
        }
      }
      if (changes.length > 0) {
        await manager.query(
          `INSERT INTO access_rule_logs (actor_user_id, actor_email, action, detail) VALUES ($1, $2, 'RULES_UPDATED', $3)`,
          [actor?.id ?? null, actor?.email ?? null, JSON.stringify({ changes })],
        );
      }
    });
    this.invalidate();
    return { saved: inputs.length, changed: changes.length };
  }

  async setUserGroups(userId: number, groupIds: number[], actor: Actor) {
    if (!Array.isArray(groupIds) || groupIds.some((g) => !Number.isInteger(g))) {
      throw new BadRequestException('groupIds doit être une liste d’entiers.');
    }
    const unique = [...new Set(groupIds)];
    await this.dataSource.transaction(async (manager) => {
      const [user] = await manager.query(`SELECT id FROM users WHERE id = $1`, [userId]);
      if (!user) throw new BadRequestException('Utilisateur introuvable.');
      if (unique.length > 0) {
        const found: { id: number }[] = await manager.query(
          `SELECT id FROM groups WHERE id = ANY($1)`,
          [unique],
        );
        if (found.length !== unique.length) throw new BadRequestException('Groupe introuvable.');
      }
      const before = await manager.query(
        `SELECT group_id FROM user_group_scopes WHERE user_id = $1`,
        [userId],
      );
      await manager.query(`DELETE FROM user_group_scopes WHERE user_id = $1`, [userId]);
      for (const groupId of unique) {
        await manager.query(`INSERT INTO user_group_scopes (user_id, group_id) VALUES ($1, $2)`, [
          userId,
          groupId,
        ]);
      }
      await manager.query(
        `INSERT INTO access_rule_logs (actor_user_id, actor_email, action, detail) VALUES ($1, $2, 'USER_GROUPS_UPDATED', $3)`,
        [
          actor?.id ?? null,
          actor?.email ?? null,
          JSON.stringify({
            userId,
            before: before.map((r: { group_id: number }) => r.group_id),
            after: unique,
          }),
        ],
      );
    });
    this.invalidate();
    return { userId, groupIds: unique };
  }

  listOverrides() {
    return this.dataSource.query(
      `SELECT o.id, o.user_id AS "userId", u.email, o.module, o.level, o.scope, o.reason,
              o.expires_at AS "expiresAt", o."createdAt"
         FROM access_overrides o JOIN users u ON u.id = o.user_id
        ORDER BY o."createdAt" DESC`,
    );
  }

  async createOverride(
    input: {
      userId: number;
      module: string;
      level: string;
      scope?: string;
      reason: string;
      expiresAt?: string | null;
    },
    actor: Actor,
  ) {
    if (!Number.isInteger(input.userId)) throw new BadRequestException('userId invalide.');
    if (!ACCESS_MODULE_CODES.includes(input.module))
      throw new BadRequestException('Module inconnu.');
    if (!isAccessLevel(input.level)) throw new BadRequestException('Niveau invalide.');
    if (input.scope !== undefined && !isAccessScope(input.scope))
      throw new BadRequestException('Portée invalide.');
    const reason = String(input.reason ?? '').trim();
    if (!reason)
      throw new BadRequestException('Un motif est obligatoire pour une exception individuelle.');
    let expiresAt: Date | null = null;
    if (input.expiresAt) {
      expiresAt = new Date(input.expiresAt);
      if (Number.isNaN(expiresAt.getTime()))
        throw new BadRequestException('Date d’expiration invalide.');
    }
    const [user] = await this.dataSource.query(`SELECT id FROM users WHERE id = $1`, [
      input.userId,
    ]);
    if (!user) throw new BadRequestException('Utilisateur introuvable.');
    const [row] = await this.dataSource.query(
      `INSERT INTO access_overrides (user_id, module, level, scope, reason, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        input.userId,
        input.module,
        input.level,
        input.scope ?? 'ALL',
        reason,
        expiresAt,
        actor?.id ?? null,
      ],
    );
    await this.log(actor, 'OVERRIDE_CREATED', { id: row.id, ...input, reason });
    this.invalidate();
    return { id: row.id };
  }

  async deleteOverride(id: number, actor: Actor) {
    const rows = await this.dataSource.query(
      `DELETE FROM access_overrides WHERE id = $1 RETURNING id, user_id`,
      [id],
    );
    if (rows.length === 0) throw new BadRequestException('Exception introuvable.');
    await this.log(actor, 'OVERRIDE_DELETED', { id, userId: rows[0].user_id });
    this.invalidate();
    return { deleted: true };
  }

  listLogs(limit = 200) {
    return this.dataSource.query(
      `SELECT id, actor_email AS "actorEmail", action, detail, "createdAt"
         FROM access_rule_logs ORDER BY id DESC LIMIT $1`,
      [Math.min(Math.max(limit, 1), 500)],
    );
  }

  /** Interrupteurs d'administration. Inconnu ou absent = désactivé (refus par défaut). */
  static readonly OPTION_KEYS = ['GROUP_SCOPE_SHOW_OTHER_TEAMS'] as const;

  async getOption(key: string): Promise<boolean> {
    const rows: { enabled: boolean }[] = await this.dataSource.query(
      `SELECT enabled FROM access_options WHERE key = $1`,
      [key],
    );
    return rows[0]?.enabled === true;
  }

  async listOptions(): Promise<Record<string, boolean>> {
    const out: Record<string, boolean> = {};
    for (const key of AccessRightsService.OPTION_KEYS) out[key] = await this.getOption(key);
    return out;
  }

  async setOption(key: string, enabled: boolean, actor: Actor) {
    if (!(AccessRightsService.OPTION_KEYS as readonly string[]).includes(key)) {
      throw new BadRequestException('Option inconnue');
    }
    await this.dataSource.query(
      `INSERT INTO access_options (key, enabled, "updatedAt") VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET enabled = EXCLUDED.enabled, "updatedAt" = now()`,
      [key, enabled === true],
    );
    await this.log(actor, 'OPTION_UPDATED', { key, enabled: enabled === true });
    return this.listOptions();
  }

  private async log(actor: Actor, action: string, detail: unknown) {
    await this.dataSource.query(
      `INSERT INTO access_rule_logs (actor_user_id, actor_email, action, detail) VALUES ($1, $2, $3, $4)`,
      [actor?.id ?? null, actor?.email ?? null, action, JSON.stringify(detail)],
    );
  }
}
