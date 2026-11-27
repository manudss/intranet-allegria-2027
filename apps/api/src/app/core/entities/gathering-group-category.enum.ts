/**
 * Catégorie d'un groupe de rassemblement : rattaché à une branche (TA / ES) ou mixte.
 * Un groupe TA ou ES n'accepte que les équipes de sa piste ; un groupe mixte accepte toutes
 * les équipes. Les couleurs et logos d'affichage sont ceux des pistes du programme.
 */
export enum GatheringGroupCategory {
  TA = 'TA',
  ES = 'ES',
  MIXTE = 'MIXTE',
}
