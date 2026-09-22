import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { HostFamilyStatus } from '../entities';

export class CreateHostFamilyDto {
  @ApiProperty({ example: 'Famille Bernard' })
  familyName!: string;

  @ApiProperty({ example: '12 rue des Tilleuls' })
  address!: string;

  @ApiProperty({ example: '69003' })
  postalCode!: string;

  @ApiProperty({ example: 'Lyon' })
  city!: string;

  @ApiPropertyOptional({ example: '+33472727272' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'bernard@example.org' })
  email?: string | null;

  @ApiProperty({ example: 6, minimum: 1 })
  maxCapacity!: number;

  @ApiPropertyOptional({ example: 4, minimum: 0 })
  maxUnder18?: number;

  @ApiPropertyOptional({ example: 'Sainte Blandine' })
  parish?: string | null;

  @ApiPropertyOptional({ example: 'Dispose de deux chambres separees.' })
  notes?: string | null;

  @ApiPropertyOptional({ example: 45.7602, nullable: true }) latitude?: number | null;
  @ApiPropertyOptional({ example: 4.8357, nullable: true }) longitude?: number | null;
  @ApiPropertyOptional({ example: 2, nullable: true }) maxAnimators?: number | null;
  @ApiPropertyOptional({ type: [String], nullable: true }) constraints?: string[] | null;
  @ApiPropertyOptional({ type: [String], nullable: true }) tags?: string[] | null;
  @ApiPropertyOptional({ enum: HostFamilyStatus, default: HostFamilyStatus.DRAFT })
  status?: HostFamilyStatus;
}

export class UpdateHostFamilyDto extends PartialType(CreateHostFamilyDto) {}
