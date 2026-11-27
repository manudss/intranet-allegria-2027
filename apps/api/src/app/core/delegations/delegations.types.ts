import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { AssignmentPersonType, TransportDirection, TransportMode } from '../entities';

export class CreateTransportDto {
  @ApiProperty({ enum: TransportDirection, example: 'ALLER' })
  @IsEnum(TransportDirection)
  direction!: TransportDirection;

  @ApiProperty({ enum: TransportMode, example: 'CAR' })
  @IsEnum(TransportMode)
  transportMode!: TransportMode;

  @ApiProperty({ example: 'Car · Part-Dieu 8h12' })
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ example: '2027-10-29T08:12:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  departureDatetime?: string | null;

  @ApiPropertyOptional({ example: '2027-10-29T11:40:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  arrivalDatetime?: string | null;

  @ApiPropertyOptional({ example: 'Gare de Lyon Part-Dieu, quai 4', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  meetingPoint?: string | null;

  @ApiPropertyOptional({ example: 48, nullable: true, description: 'Jauge facultative ; vide = sans limite.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number | null;

  @ApiPropertyOptional({ example: 'RDV quai 4 dès 7h50 · prévoir un pique-nique', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  practicalInfo?: string | null;

  @ApiPropertyOptional({ example: 'Chauffeur : Transdev, contact P. Martin', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateTransportDto extends PartialType(CreateTransportDto) {}

export class CreateExceptionDto {
  @ApiProperty({ enum: AssignmentPersonType, example: 'PARTICIPANT' })
  @IsEnum(AssignmentPersonType)
  personType!: AssignmentPersonType;

  @ApiProperty({ example: 128 })
  @IsInt()
  personId!: number;

  @ApiProperty({ enum: TransportDirection, example: 'ALLER' })
  @IsEnum(TransportDirection)
  direction!: TransportDirection;

  @ApiProperty({ example: 7, description: 'Délégation d\'accueil (différente de celle de la personne).' })
  @IsInt()
  toDelegationId!: number;

  @ApiPropertyOptional({
    example: 'Famille à Annecy ce week-end, accord du responsable.',
    description:
      'Note facultative : si elle est remplie, elle est créée avec l\'exception (signée, datée) et visible dans le suivi des notes.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;
}

export class AssignTransportDto {
  @ApiProperty({ enum: AssignmentPersonType, example: 'PARTICIPANT' })
  @IsEnum(AssignmentPersonType)
  personType!: AssignmentPersonType;

  @ApiProperty({ example: 128 })
  @IsInt()
  personId!: number;
}

export class CreateNoteDto {
  @ApiProperty({ example: 'Camille monte dans le car à Bourg-en-Bresse, pas à Part-Dieu.' })
  @IsString()
  @MaxLength(4000)
  body!: string;
}

export class ReplyNoteDto {
  @ApiProperty({ example: 'C\'est noté, arrêt confirmé avec le chauffeur.' })
  @IsString()
  @MaxLength(4000)
  body!: string;
}

export const NOTE_FEED_FILTERS = ['WITH_NOTES', 'UNANSWERED', 'ALL'] as const;
export type NoteFeedFilter = (typeof NOTE_FEED_FILTERS)[number];

export class NotesFeedQueryDto {
  @ApiPropertyOptional({ enum: NOTE_FEED_FILTERS, example: 'WITH_NOTES' })
  @IsOptional()
  @IsIn(NOTE_FEED_FILTERS)
  filter?: NoteFeedFilter;

  @ApiPropertyOptional({ example: 'Camille', description: 'Recherche par nom ou prénom.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class RepartitionQueryDto {
  @ApiProperty({ enum: TransportDirection, example: 'ALLER' })
  @IsEnum(TransportDirection)
  direction!: TransportDirection;
}

export class TransportsQueryDto {
  @ApiPropertyOptional({ enum: TransportDirection })
  @IsOptional()
  @IsEnum(TransportDirection)
  direction?: TransportDirection;
}
