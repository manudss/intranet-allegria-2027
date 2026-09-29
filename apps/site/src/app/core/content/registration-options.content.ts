/**
 * Options éditoriales pour les listes déroulantes des formulaires d'inscription
 * publics. Les valeurs (`value`) doivent rester synchronisées avec les enums
 * `ParticipantSex` et `MejAgeGroup` de l'API (voir apps/api/src/app/core/entities/).
 */
export interface SelectOption {
  value: string;
  label: string;
}

export const PARTICIPANT_SEX_OPTIONS: SelectOption[] = [
  { value: 'FEMALE', label: 'Fille / Femme' },
  { value: 'MALE', label: 'Garçon / Homme' },
  { value: 'OTHER', label: 'Autre' },
  { value: 'UNDISCLOSED', label: 'Je ne souhaite pas préciser' },
];

export const MEJ_AGE_GROUP_OPTIONS: SelectOption[] = [
  { value: 'TA', label: 'Tranche Témoins Aujourd\'hui (TA)' },
  { value: 'ES', label: 'Tranche Équipe Espérance (ES)' },
];
