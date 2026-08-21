import { ApiProperty } from '@nestjs/swagger';
import { VolunteerSkillType } from '../entities';

export class AddSkillDto {
  @ApiProperty({ enum: VolunteerSkillType })
  skill!: VolunteerSkillType;
}

export class AddTagDto {
  @ApiProperty({ example: 'musique' })
  value!: string;
}

export class FindVolunteersQueryDto {
  skill?: VolunteerSkillType;
  tag?: string;
}
