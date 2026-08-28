import { ApiPropertyOptional } from '@nestjs/swagger';
import { VolunteerAuditAction } from '../entities';

export class SearchVolunteerAuditLogsQueryDto {
  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  limit?: number | string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  offset?: number | string;

  @ApiPropertyOptional({ example: 12 })
  userId?: number | string;

  @ApiPropertyOptional({ enum: VolunteerAuditAction })
  action?: VolunteerAuditAction;

  @ApiPropertyOptional({ example: 'volunteer_shift_assignments' })
  entityType?: string;

  @ApiPropertyOptional({ example: '2027-07-20T00:00:00.000Z' })
  from?: string;

  @ApiPropertyOptional({ example: '2027-07-27T23:59:59.999Z' })
  to?: string;
}

