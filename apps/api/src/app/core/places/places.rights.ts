import type { EffectiveGrant } from '../access-rights/access-rights.service';
import type { AccessLevel } from '../access-rights/access-modules';

const RANK: Record<AccessLevel, number> = { VIEW: 1, EDIT: 2, MANAGE: 3 };

export type Grants = Record<string, EffectiveGrant>;

/** Vrai si un couple niveau/portée donne au moins `level` avec la portée « tout ». Échec fermé. */
export function hasAll(grants: Grants, module: string, level: AccessLevel = 'VIEW'): boolean {
  return (grants[module]?.pairs ?? []).some((p) => p.scope === 'ALL' && RANK[p.level] >= RANK[level]);
}

/** Vrai si un couple (n'importe quelle portée) donne au moins `level`. */
export function hasAny(grants: Grants, module: string, level: AccessLevel = 'VIEW'): boolean {
  return (grants[module]?.pairs ?? []).some((p) => RANK[p.level] >= RANK[level]);
}

/** Modules dont le droit de lecture suffit à voir le NOM des lieux dans un sélecteur. */
export const PICKER_MODULES = ['PLACES', 'AGENDA', 'OPERATIONAL_TEAMS', 'GATHERING_GROUPS'] as const;

export type RelationVisibility = {
  events: boolean;
  missions: boolean;
  groups: 'ALL' | 'OWN' | false;
  teams: boolean;
  responsible: boolean;
};

/**
 * Ce que la personne a le droit de voir comme objets liés à un lieu. Chaque relation suit le droit
 * de son module source ; ce qui est caché est absent de la réponse, compteurs compris.
 */
export function relationVisibility(grants: Grants): RelationVisibility {
  return {
    events: hasAll(grants, 'AGENDA'),
    missions: hasAll(grants, 'OPERATIONAL_TEAMS'),
    groups: hasAll(grants, 'GATHERING_GROUPS')
      ? 'ALL'
      : hasAny(grants, 'GATHERING_GROUPS') && (grants['GATHERING_GROUPS']?.pairs ?? []).some((p) => p.scope === 'GROUPS')
        ? 'OWN'
        : false,
    teams: hasAll(grants, 'OPERATIONAL_TEAMS'),
    responsible: hasAll(grants, 'VOLUNTEER_DIRECTORY'),
  };
}

export const roomDisplayName = (placeName: string, roomName: string | null | undefined): string =>
  roomName ? `${placeName} · ${roomName}` : placeName;
