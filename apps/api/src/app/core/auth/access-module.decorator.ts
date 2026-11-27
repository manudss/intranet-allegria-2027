import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AccessLevel, AccessModuleCode } from '../access-rights/access-modules';

export const ACCESS_MODULE_KEY = 'access_module';
export const ACCESS_LEVEL_KEY = 'access_level';

/**
 * Soumet la route (ou le contrôleur) à la matrice de droits configurable.
 * Niveau exigé : GET = Voir, PATCH/PUT = Modifier, POST/DELETE = Gérer, sauf @AccessLevel(...).
 * Sur une route marquée, la matrice remplace la liste @Roles (jamais les deux).
 */
export const AccessModule = (module: AccessModuleCode) => SetMetadata(ACCESS_MODULE_KEY, module);
export const AccessLevelRequired = (level: AccessLevel) => SetMetadata(ACCESS_LEVEL_KEY, level);

export const GROUP_SCOPE_AWARE_KEY = 'access_group_scope_aware';
/**
 * Déclare que le contrôleur filtre lui-même ses données par groupes de rassemblement.
 * Sans cette marque, une portée « groupes » est refusée (fermé par défaut).
 */
export const GroupScopeAware = () => SetMetadata(GROUP_SCOPE_AWARE_KEY, true);

export type AccessScopeInfo = { all: true } | { all: false; groupIds: number[] };

/** Portée calculée par la garde pour la requête en cours. */
export const AccessScope = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AccessScopeInfo => {
    const request = ctx.switchToHttp().getRequest();
    // Échec fermé : sans portée posée par la garde, aucune donnée de groupe n'est visible.
    return request.accessScope ?? { all: false, groupIds: [] };
  },
);

export const VOLUNTEER_SCOPE_AWARE_KEY = 'access_volunteer_scope_aware';
/**
 * Déclare que la route filtre elle-même ses données par bénévoles visibles (portées « son équipe »
 * et « soi-même »). Sans cette marque, ces portées sont refusées (fermé par défaut).
 */
export const VolunteerScopeAware = () => SetMetadata(VOLUNTEER_SCOPE_AWARE_KEY, true);

/** Bénévoles visibles pour la requête : null = tous (portée « tout »), sinon la liste (vide = aucun). */
export const VolunteerScope = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): number[] | null => {
    const request = ctx.switchToHttp().getRequest();
    if (request.accessScope?.all === true) return null;
    return request.volunteerScopeIds ?? [];
  },
);

/** Fiches bénévoles du compte (null = portée « tout »). Utile aux routes marquées VolunteerScopeAware. */
export const OwnVolunteerIds = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): number[] | null => {
    const request = ctx.switchToHttp().getRequest();
    if (request.accessScope?.all === true) return null;
    return request.ownVolunteerIds ?? [];
  },
);

/** Équipes opérationnelles actives du compte aujourd'hui (null = portée « tout »). */
export const OwnTeamIds = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): number[] | null => {
    const request = ctx.switchToHttp().getRequest();
    if (request.accessScope?.all === true) return null;
    return request.ownTeamIds ?? [];
  },
);

export const GATHERING_SCOPE_AWARE_KEY = 'access_gathering_scope_aware';
/**
 * Déclare que la route filtre elle-même ses données par groupes de rassemblement
 * (portée « ses groupes » : les groupes dont le compte est responsable). Sans cette
 * marque, une telle portée est refusée (fermé par défaut).
 */
export const GatheringScopeAware = () => SetMetadata(GATHERING_SCOPE_AWARE_KEY, true);

export type GatheringScopeInfo = { all: true } | { all: false; gatheringGroupIds: number[] };

/** Portée « ses groupes de rassemblement » calculée par la garde pour la requête en cours. */
export const GatheringScope = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): GatheringScopeInfo => {
    const request = ctx.switchToHttp().getRequest();
    // Échec fermé : sans portée posée par la garde, aucun groupe n'est visible.
    return request.gatheringScope ?? { all: false, gatheringGroupIds: [] };
  },
);
