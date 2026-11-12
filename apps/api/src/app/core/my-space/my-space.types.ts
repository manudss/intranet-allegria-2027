import { ApiPropertyOptional } from '@nestjs/swagger';

/** Champs que le bénévole peut modifier lui-même (liste blanche stricte). */
export class UpdateMyVolunteerDto {
  @ApiPropertyOptional({ example: '+33612345678', nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'camille.perrot@example.fr', nullable: true })
  email?: string | null;
}
