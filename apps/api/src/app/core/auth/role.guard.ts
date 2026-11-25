import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessRightsService } from '../access-rights/access-rights.service';
import { AccessLevel, LEVEL_RANK } from '../access-rights/access-modules';
import {
  ACCESS_LEVEL_KEY,
  ACCESS_MODULE_KEY,
  GROUP_SCOPE_AWARE_KEY,
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
    if (!grant || LEVEL_RANK[grant.level] < LEVEL_RANK[required]) {
      throw new ForbiddenException('Droits insuffisants pour ce module');
    }
    if (grant.scope === 'ALL') {
      request.accessScope = { all: true };
      return true;
    }
    const aware = this.reflector.getAllAndOverride<boolean | undefined>(GROUP_SCOPE_AWARE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (grant.scope === 'GROUPS' && aware) {
      // Portée par groupes : la route filtre ses données avec cette liste (vide = aucun accès).
      request.accessScope = {
        all: false,
        groupIds: await this.accessRights.groupIdsForUser(user.id),
      };
      return true;
    }
    throw new ForbiddenException('Portée de droits non prise en charge par cette route');
  }
}
