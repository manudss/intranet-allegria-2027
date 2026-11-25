/**
 * Modules de l'application sur lesquels l'admin règle des droits.
 * La liste est fixe (elle suit les écrans et les routes) ; niveaux et portées sont réglables en admin.
 */
export const ACCESS_LEVELS = ['VIEW', 'EDIT', 'MANAGE'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_SCOPES = ['ALL', 'GROUPS', 'OWN_TEAM', 'SELF'] as const;
export type AccessScope = (typeof ACCESS_SCOPES)[number];

export const ACCESS_SUBJECT_KINDS = ['ROLE', 'TEAM_TYPE'] as const;
export type AccessSubjectKind = (typeof ACCESS_SUBJECT_KINDS)[number];

export const LEVEL_RANK: Record<AccessLevel, number> = { VIEW: 1, EDIT: 2, MANAGE: 3 };
/** Plus la portée est large, plus le rang est haut. */
export const SCOPE_RANK: Record<AccessScope, number> = { SELF: 1, OWN_TEAM: 2, GROUPS: 3, ALL: 4 };

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  VIEW: 'Voir',
  EDIT: 'Modifier',
  MANAGE: 'Gérer',
};

export const ACCESS_SCOPE_LABELS: Record<AccessScope, string> = {
  ALL: 'Tout',
  GROUPS: 'Groupes autorisés',
  OWN_TEAM: 'Son équipe',
  SELF: 'Soi-même',
};

export const ACCESS_MODULES = [
  { code: 'PARTICIPANTS', label: 'Inscriptions et participants' },
  { code: 'HEALTH', label: 'Dossiers santé' },
  { code: 'HOST_FAMILIES', label: "Familles d'accueil" },
  { code: 'HOUSING', label: 'Hébergement et placement' },
  { code: 'GATHERING_TEAMS', label: 'Équipes de rassemblement (jeunes)' },
  { code: 'VOLUNTEER_DIRECTORY', label: 'Annuaire des bénévoles' },
  { code: 'OPERATIONAL_TEAMS', label: 'Équipes opérationnelles et missions' },
  { code: 'AGENDA', label: 'Agenda et programme' },
  { code: 'DASHBOARD', label: 'Tableau de bord Jour J et incidents' },
  { code: 'BADGES', label: 'Badges et impression' },
  { code: 'SCAN', label: 'Scan sur le terrain' },
  { code: 'CATERING', label: 'Restauration' },
  { code: 'TRANSPORT', label: 'Transports' },
  { code: 'DOCUMENTS', label: 'Consignes et documents' },
  { code: 'AUDIT', label: 'Journal et audit' },
  { code: 'ADMIN', label: 'Utilisateurs, droits et exports' },
] as const;

export type AccessModuleCode = (typeof ACCESS_MODULES)[number]['code'];
export const ACCESS_MODULE_CODES: readonly string[] = ACCESS_MODULES.map((m) => m.code);

export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === 'string' && (ACCESS_LEVELS as readonly string[]).includes(value);
}
export function isAccessScope(value: unknown): value is AccessScope {
  return typeof value === 'string' && (ACCESS_SCOPES as readonly string[]).includes(value);
}
