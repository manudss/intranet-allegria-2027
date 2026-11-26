import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessRightsService } from '../access-rights/access-rights.service';
import { AccessLevel, LEVEL_RANK } from '../access-rights/access-modules';
import {
  ACCESS_LEVEL_KEY,
  ACCESS_MODULE_KEY,
  GATHERING_SCOPE_AWARE_KEY,
  GROUP_SCOPE_AWARE_KEY,
  VOLUNTEER_SCOPE_AWARE_KEY,
} from './access-module.decorator';
import { ROLES_KEY } from './roles.decorator';

type AuthenticatedUser = {
  id: number;
  email: string;
  roles: string[];
};

const METHOD_LEVEL: Record<string, AccessLevel> = {
  GET: 'VIEW',
  HEAD: 'VIEW',
  OPTIONS: 'VIEW',
  PATCH: 'EDIT',
  PUT: 'EDIT',
  POST: 'MANAGE',
  DELETE: 'MANAGE',
};

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessRights: AccessRightsService,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const module = this.reflector.getAllAndOverride<string | undefined>(ACCESS_MODULE_KEY, targets);

    if (module) {
      return this.canAccessModule(context, module);
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifie');
    }

    const hasRole = requiredRoles.some((requiredRole) => user.roles.includes(requiredRole));

    if (!hasRole) {
      throw new ForbiddenException('Role insuffisant');
    }

    return true;
  }

  /**
   * Route soumise à la matrice de droits. Refus par défaut : sans règle, pas d'accès.
   * Seule la portée « tout » est appliquée ici ; les portées partielles (groupes, son équipe,
   * soi-même) exigent un filtrage des données par le service et ne suffisent pas à ouvrir la route.
   */
  private async canAccessModule(context: ExecutionContext, module: string): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifie');
    }
    const required: AccessLevel =
      this.reflector.getAllAndOverride<AccessLevel | undefined>(ACCESS_LEVEL_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ??
      METHOD_LEVEL[String(request.method).toUpperCase()] ??
      'MANAGE';

    const grants = await this.accessRights.effective(user.id, user.roles);
    const grant = grants[module];
    // Seuls les couples dont le niveau suffit comptent ; on garde la portée la plus large parmi eux.
    const usable = (grant?.pairs ?? []).filter((p) => LEVEL_RANK[p.level] >= LEVEL_RANK[required]);
    if (usable.length === 0) {
      throw new ForbiddenException('Droits insuffisants pour ce module');
    }
    if (usable.some((p) => p.scope === 'ALL')) {
      request.accessScope = { all: true };
      request.gatheringScope = { all: true };
      return true;
    }
    const aware = this.reflector.getAllAndOverride<boolean | undefined>(GROUP_SCOPE_AWARE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (aware && usable.some((p) => p.scope === 'GROUPS')) {
      // Portée par groupes : la route filtre ses données avec cette liste (vide = aucun accès).
      request.accessScope = {
        all: false,
        groupIds: await this.accessRights.groupIdsForUser(user.id),
      };
      return true;
    }
    const gatheringAware = this.reflector.getAllAndOverride<boolean | undefined>(
      GATHERING_SCOPE_AWARE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (gatheringAware && usable.some((p) => p.scope === 'GROUPS')) {
      // Portée « ses groupes » : les groupes de rassemblement dont le compte est responsable
      // (vide = aucun accès). La route filtre ses données avec cette liste.
      request.gatheringScope = {
        all: false,
        gatheringGroupIds: await this.accessRights.gatheringGroupIdsForUser(user.id),
      };
      return true;
    }
    const volunteerAware = this.reflector.getAllAndOverride<boolean | undefined>(
      VOLUNTEER_SCOPE_AWARE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const own = usable.filter((p) => p.scope === 'OWN_TEAM' || p.scope === 'SELF');
    if (volunteerAware && own.length && own.length === usable.length) {
      // Portée « son équipe » / « soi-même » : liens compte-bénévole posés à la main en admin.
      request.volunteerScopeIds = await this.accessRights.volunteerIdsForScopes(
        user.id,
        own.map((p) => p.scope as 'OWN_TEAM' | 'SELF'),
      );
      const ctxOwn = await this.accessRights.ownTeamContext(user.id);
      request.ownVolunteerIds = ctxOwn.volunteerIds;
      request.ownTeamIds = ctxOwn.teamIds;
      request.accessScope = { all: false, groupIds: [] };
      return true;
    }
    throw new ForbiddenException('Portée de droits non prise en charge par cette route');
  }
}
