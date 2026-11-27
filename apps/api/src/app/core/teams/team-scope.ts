import type { AccessScopeInfo } from '../auth/access-module.decorator';

/**
 * Périmètre d'accès par rattachement des personnes (plan « Délégations et transports »
 * validé par Emmanuel le 27/11/2026) : la délégation d'une équipe se déduit de ses
 * membres, au lieu du lien historique équipe→délégation (teams.group_id).
 *
 * Aujourd'hui seuls les participants (jeunes et animateurs inscrits côté participants)
 * portent une délégation ; les référents bénévoles rejoindront la dérivation quand
 * leur rattachement existera (chantier délégations, PR #56). Le lien historique
 * teams.group_id reste en base pendant la transition mais ne sert plus au filtrage
 * d'accès ; rien n'est supprimé avant bascule complète.
 */

export interface TeamScopeShape {
  members?:
    | ({ participant?: { group?: { id?: number | null } | null } | null } | null)[]
    | null;
}

/** Délégations dérivées des membres de l'équipe : identifiants distincts, triés. */
export function derivedDelegationIds(team: TeamScopeShape): number[] {
  const ids = new Set<number>();
  for (const membership of team.members ?? []) {
    const id = membership?.participant?.group?.id;
    if (typeof id === 'number') ids.add(id);
  }
  return [...ids].sort((a, b) => a - b);
}

/** Une équipe sans aucun membre n'a pas encore de délégation dérivable. */
export function isTeamEmpty(team: TeamScopeShape): boolean {
  return (team.members ?? []).length === 0;
}

/**
 * Lecture : une équipe est visible d'un compte limité si au moins un de ses membres
 * est rattaché à une de ses délégations. L'appartenance d'un seul membre ne donne pas
 * accès aux personnes des autres délégations : les listes de membres restent filtrées
 * par personne (cf. TeamsService.getParticipants) et les effectifs renvoyés restent
 * des agrégats sans identité. Une équipe vide n'est visible que des comptes « tout ».
 */
export function isTeamInScope(team: TeamScopeShape, scope: AccessScopeInfo): boolean {
  if (scope.all) return true;
  return derivedDelegationIds(team).some((id) => scope.groupIds.includes(id));
}

/**
 * Composition (ajout/retrait de membres, répartition) : une équipe vide est neutre —
 * elle rejoint la portée du premier membre qu'on y rattache, ce qui reproduit le flux
 * « créer puis remplir » sans lien équipe→délégation stocké. Une équipe dont tous les
 * membres sont hors portée reste inaccessible en écriture comme en lecture.
 */
export function isTeamWritableInScope(team: TeamScopeShape, scope: AccessScopeInfo): boolean {
  if (scope.all) return true;
  if (isTeamEmpty(team)) return true;
  return isTeamInScope(team, scope);
}
