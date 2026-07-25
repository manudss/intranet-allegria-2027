import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeamParticipantRole } from '../entities';

export class AddTeamParticipantDto {
  @ApiProperty({ example: 501 })
  participantId!: number;

  @ApiPropertyOptional({ enum: TeamParticipantRole, example: TeamParticipantRole.MEMBER })
  role?: TeamParticipantRole;

  @ApiPropertyOptional({ example: 'Participant deja forme pour co-animation.' })
  notes?: string | null;
}


