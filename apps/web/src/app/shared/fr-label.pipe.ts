import { Pipe, PipeTransform } from '@angular/core';

/** Libellés français des valeurs techniques (statuts, types) affichées à l'écran. */
export const FR_LABELS: Record<string, string> = {
  JEUNE: 'Jeune',
  ANIMATEUR: 'Animateur',
  BENEVOLE: 'Bénévole',
  PENDING: 'En attente',
  PROVISIONAL: 'Provisoire',
  CONFIRMED: 'Confirmé',
  CANCELLED: 'Annulé',
  DRAFT: 'À compléter',
  SUBMITTED: 'En vérification',
  CORRECTION: 'Correction demandée',
  VALIDATED: 'Validé',
  REFUSED: 'Refusé',
  INACTIVE: 'Inactif',
  MEMBER: 'Membre',
  ASSISTANT: 'Assistant',
};

@Pipe({ name: 'frLabel', standalone: true })
export class FrLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return FR_LABELS[value] ?? value;
  }
}
