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
    return request.accessScope ?? { all: true };
  },
);
