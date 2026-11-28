/** Types de lieux du rassemblement (filtres de la liste et du sélecteur). */
export enum PlaceKind {
  /** Grand lieu du rassemblement (centre ou palais des congrès…). */
  GATHERING = 'GATHERING',
  SCHOOL = 'SCHOOL',
  RESTAURATION = 'RESTAURATION',
  PARK = 'PARK',
  MUSEUM = 'MUSEUM',
  PARISH = 'PARISH',
  LODGING = 'LODGING',
  OTHER = 'OTHER',
}

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  [PlaceKind.GATHERING]: 'Lieu du rassemblement',
  [PlaceKind.SCHOOL]: 'Lycée / école',
  [PlaceKind.RESTAURATION]: 'Restauration',
  [PlaceKind.PARK]: 'Parc',
  [PlaceKind.MUSEUM]: 'Musée',
  [PlaceKind.PARISH]: 'Paroisse',
  [PlaceKind.LODGING]: 'Hébergement',
  [PlaceKind.OTHER]: 'Autre',
};
