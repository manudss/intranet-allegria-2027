import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignBenevoleDto {
  @ApiProperty({ example: 42 })
  volunteerId!: number;

  @ApiPropertyOptional({ example: 'Cuisine du samedi soir, rejoint l équipe pour dormir.' })
  notes?: string | null;
}

/** Affectation d'un bénévole à une équipe de rassemblement, en tant qu'adulte. */
export interface BenevoleAssignment {
  volunteerId: number;
  /** Fiche participant BENEVOLE créée comme projection du bénévole. */
  participantId: number;
  teamId: number;
  teamName: string;
  firstName: string;
  lastName: string;
  /** Pôle/mission déclaré sur la fiche bénévole. */
  mission: string | null;
}
