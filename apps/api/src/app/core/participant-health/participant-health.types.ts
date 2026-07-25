import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateParticipantHealthDto {
  @ApiPropertyOptional({ example: 'Asthme leger' })
  medicalConditions?: string | null;

  @ApiPropertyOptional({ example: 'Arachides' })
  allergies?: string | null;

  @ApiPropertyOptional({ example: 'Ventoline en cas de crise' })
  medications?: string | null;

  @ApiPropertyOptional({ example: 'Temps de repos renforce apres effort' })
  specialNeeds?: string | null;

  @ApiPropertyOptional({ example: 'Regime sans porc' })
  dietaryNotes?: string | null;

  @ApiPropertyOptional({ example: 'Appeler le SAMU si detresse respiratoire' })
  emergencyInstructions?: string | null;
}


