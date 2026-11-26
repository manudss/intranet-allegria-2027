import type { AccessLevel, AccessModuleCode, AccessSubjectKind } from './access-modules';

type Grants = Partial<Record<AccessModuleCode, 'V' | 'E' | 'G'>>;

const LVL: Record<'V' | 'E' | 'G', AccessLevel> = { V: 'VIEW', E: 'EDIT', G: 'MANAGE' };

/**
 * Droits de départ PROPOSÉS (dossier « Droits Alegria », 25 nov. 2026), modifiables en admin.
 * Absent = aucun accès. Portée ALL par défaut ; les portées « son équipe » / « soi-même » ne sont
 * pas appliquées par le serveur sur les routes génériques (refus prudent) : voir le rapport.
 */
const ROLE_GRANTS: Record<string, Grants> = {
  ADMIN: {
    PARTICIPANTS: 'G',
    HOST_FAMILIES: 'G',
    HOUSING: 'G',
    GATHERING_TEAMS: 'G',
    VOLUNTEER_DIRECTORY: 'G',
    OPERATIONAL_TEAMS: 'G',
    AGENDA: 'G',
    DASHBOARD: 'G',
    BADGES: 'G',
    SCAN: 'G',
    CATERING: 'G',
    TRANSPORT: 'G',
    DOCUMENTS: 'G',
    AUDIT: 'G',
    ADMIN: 'G',
  },
  COORDINATOR: {
    PARTICIPANTS: 'G',
    HOST_FAMILIES: 'G',
    HOUSING: 'G',
    GATHERING_TEAMS: 'G',
    VOLUNTEER_DIRECTORY: 'G',
    OPERATIONAL_TEAMS: 'G',
    AGENDA: 'G',
    DASHBOARD: 'G',
    BADGES: 'V',
    CATERING: 'V',
    TRANSPORT: 'G',
    DOCUMENTS: 'G',
    AUDIT: 'V',
  },
  HEALTH: {
    PARTICIPANTS: 'V',
    HOUSING: 'V',
    OPERATIONAL_TEAMS: 'E',
    HEALTH: 'G',
    VOLUNTEER_DIRECTORY: 'V',
    AGENDA: 'V',
    DASHBOARD: 'E',
    DOCUMENTS: 'V',
  },
  CATERING: { AGENDA: 'V', DASHBOARD: 'V', CATERING: 'G', DOCUMENTS: 'V' },
  LOGISTICS: {
    PARTICIPANTS: 'V',
    HOST_FAMILIES: 'G',
    HOUSING: 'G',
    GATHERING_TEAMS: 'V',
    VOLUNTEER_DIRECTORY: 'V',
    OPERATIONAL_TEAMS: 'G',
    AGENDA: 'V',
    DASHBOARD: 'E',
    CATERING: 'V',
    TRANSPORT: 'G',
    DOCUMENTS: 'V',
  },
  BADGE_MANAGER: {
    PARTICIPANTS: 'V',
    DASHBOARD: 'V',
    BADGES: 'G',
    SCAN: 'V',
    DOCUMENTS: 'V',
    AUDIT: 'V',
  },
  SCANNER: { SCAN: 'E', DOCUMENTS: 'V' },
  ANIMATOR: {
    PARTICIPANTS: 'V',
    GATHERING_TEAMS: 'E',
    OPERATIONAL_TEAMS: 'E',
    AGENDA: 'G',
    DASHBOARD: 'V',
    DOCUMENTS: 'V',
  },
  VOLUNTEERS: {
    HOUSING: 'V',
    VOLUNTEER_DIRECTORY: 'V',
    OPERATIONAL_TEAMS: 'E',
    AGENDA: 'V',
    DOCUMENTS: 'V',
  },
  VIEWER: {
    HOUSING: 'V',
    GATHERING_TEAMS: 'V',
    VOLUNTEER_DIRECTORY: 'V',
    OPERATIONAL_TEAMS: 'V',
    AGENDA: 'V',
    DASHBOARD: 'V',
    DOCUMENTS: 'V',
  },
};

/** Types d'équipes opérationnelles (codes de volunteer_team_types). */
const TEAM_TYPE_GRANTS: Record<string, Grants> = {
  ACCUEIL: ROLE_GRANTS['BADGE_MANAGER'],
  SECURITE: { AGENDA: 'V', DASHBOARD: 'V', DOCUMENTS: 'V' },
  RESTAURATION: ROLE_GRANTS['CATERING'],
  ANIMATION_PROGRAMME: ROLE_GRANTS['ANIMATOR'],
  LOGISTIQUE_TRANSPORTS: {
    HOST_FAMILIES: 'V',
    HOUSING: 'E',
    GATHERING_TEAMS: 'V',
    VOLUNTEER_DIRECTORY: 'V',
    OPERATIONAL_TEAMS: 'E',
    AGENDA: 'V',
    DASHBOARD: 'E',
    CATERING: 'V',
    TRANSPORT: 'G',
    DOCUMENTS: 'V',
  },
  SANTE_SECOURS: ROLE_GRANTS['HEALTH'],
  HEBERGEMENT_FAMILLES: {
    PARTICIPANTS: 'V',
    HOST_FAMILIES: 'G',
    HOUSING: 'G',
    GATHERING_TEAMS: 'V',
    AGENDA: 'V',
    DASHBOARD: 'V',
    DOCUMENTS: 'V',
  },
  SCANNERS: ROLE_GRANTS['SCANNER'],
  COORDINATION: ROLE_GRANTS['COORDINATOR'],
};

export type DefaultAccessRule = {
  subjectKind: AccessSubjectKind;
  subjectKey: string;
  module: AccessModuleCode;
  level: AccessLevel;
  scope: 'ALL';
};

function expand(kind: AccessSubjectKind, table: Record<string, Grants>): DefaultAccessRule[] {
  return Object.entries(table).flatMap(([subjectKey, grants]) =>
    Object.entries(grants).map(([module, level]) => ({
      subjectKind: kind,
      subjectKey,
      module: module as AccessModuleCode,
      level: LVL[level as 'V' | 'E' | 'G'],
      scope: 'ALL' as const,
    })),
  );
}

export const DEFAULT_ACCESS_RULES: readonly DefaultAccessRule[] = [
  ...expand('ROLE', ROLE_GRANTS),
  ...expand('TEAM_TYPE', TEAM_TYPE_GRANTS),
];

/**
 * Droits effectifs calculés depuis les seuls défauts pour une liste de rôles (sans base de données).
 * Sert aux tests ; la vraie résolution est AccessRightsService.effective.
 */
export function defaultEffectiveForRoles(roles: string[]) {
  const out: Record<
    string,
    {
      module: string;
      level: AccessLevel;
      scope: 'ALL';
      pairs: { level: AccessLevel; scope: 'ALL' }[];
      sources: string[];
    }
  > = {};
  const rank: Record<AccessLevel, number> = { VIEW: 1, EDIT: 2, MANAGE: 3 };
  for (const rule of DEFAULT_ACCESS_RULES) {
    if (rule.subjectKind !== 'ROLE' || !roles.includes(rule.subjectKey)) continue;
    const cur = out[rule.module];
    if (!cur) {
      out[rule.module] = {
        module: rule.module,
        level: rule.level,
        scope: 'ALL',
        pairs: [{ level: rule.level, scope: 'ALL' }],
        sources: [`ROLE:${rule.subjectKey}`],
      };
    } else if (rank[rule.level] > rank[cur.level]) {
      cur.level = rule.level;
      cur.pairs = [{ level: rule.level, scope: 'ALL' }];
    }
  }
  return out;
}
