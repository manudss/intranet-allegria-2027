import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { GatheringCarPersonKind, GatheringCarTarget } from '../entities';

export class CreateCarDto {
  @ApiProperty({ example: 'Car A' })
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ example: 63, nullable: true, description: 'Jauge facultative ; vide = sans limite.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['2027-10-31', '2027-11-01'],
    description: 'Jours de circulation (dates ISO), parmi les jours du rassemblement.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true })
  @ArrayMaxSize(8)
  serviceDates?: string[] | null;

  @ApiPropertyOptional({ example: 'Chauffeur : Transdev, contact P. Martin', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateCarDto extends PartialType(CreateCarDto) {}

export class CarStopDto {
  @ApiProperty({ example: 'Zone Nord' })
  @IsString()
  @MaxLength(200)
  label!: string;

  @ApiPropertyOptional({ example: '07:30', nullable: true, description: 'Heure de passage HH:mm.' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  time?: string | null;
}

export class SetStopsDto {
  @ApiProperty({ type: [CarStopDto], description: 'Arrêts ordonnés (remplace la liste existante).' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CarStopDto)
  @ArrayMaxSize(20)
  stops!: CarStopDto[];
}

export class AssignTargetDto {
  @ApiProperty({ enum: GatheringCarTarget, example: 'HOSTING_GROUP' })
  @IsEnum(GatheringCarTarget)
  targetType!: GatheringCarTarget;

  @ApiProperty({ example: 3, description: 'Id du groupe d\'hébergement ou de l\'hébergement collectif.' })
  @IsInt()
  id!: number;
}

export class AssignTargetsDto {
  @ApiProperty({ type: [AssignTargetDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignTargetDto)
  @ArrayMaxSize(100)
  targets!: AssignTargetDto[];
}

export class SetTransportNeedDto {
  @ApiProperty({ nullable: true, type: Boolean, description: 'true = transport nécessaire, false = pas besoin, null = non renseigné.' })
  @ValidateIf((_o, v) => v !== null)
  @IsBoolean()
  needsTransport!: boolean | null;
}

export class AddCarPersonDto {
  @ApiProperty({ example: 128, description: 'Fiche participant (jeune ou animateur).' })
  @IsInt()
  participantId!: number;

  @ApiProperty({ enum: GatheringCarPersonKind, example: 'ADDED' })
  @IsEnum(GatheringCarPersonKind)
  kind!: GatheringCarPersonKind;
}
