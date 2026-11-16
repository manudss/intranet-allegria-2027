import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ProgramChangeLogAction,
  ProgramDocumentLink,
  ProgramSequenceStatus,
  ProgramSequenceTrack,
  ProgramSequenceVisibility,
} from '../entities';

export class InsertSequenceDto {
  @ApiProperty({ example: 'Atelier surprise' })
  title!: string;

  @ApiProperty({ example: 20, minimum: 1, maximum: 1440 })
  durationMinutes!: number;

  @ApiPropertyOptional({ example: 3, nullable: true })
  volunteerTeamId?: number | null;

  @ApiPropertyOptional({
    enum: ProgramSequenceVisibility,
    description: 'PUBLIC = visible sans connexion (grands temps) ; INTERNAL par défaut',
  })
  visibility?: ProgramSequenceVisibility;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;

  @ApiPropertyOptional({ example: 10, nullable: true })
  minDurationMinutes?: number | null;

  @ApiPropertyOptional({ example: 5, nullable: true })
  minMarginMinutes?: number | null;

  @ApiPropertyOptional({
    enum: ProgramSequenceTrack,
    description: 'Piste visée : TA, ES ou temps commun (défaut : COMMON)',
  })
  track?: ProgramSequenceTrack;
}

export class InsertSequenceApplyDto extends InsertSequenceDto {
  @ApiProperty({ description: "Version de la chaîne renvoyée par l'aperçu" })
  version!: string;
}

export class ResizeSequenceDto {
  @ApiProperty({ example: 45, minimum: 1, maximum: 1440 })
  durationMinutes!: number;
}

export class ResizeSequenceApplyDto extends ResizeSequenceDto {
  @ApiProperty({ description: "Version de la chaîne renvoyée par l'aperçu" })
  version!: string;
}

export class CreateSequenceDto extends InsertSequenceDto {
  @ApiProperty({ example: '2027-10-31' })
  eventDate!: string;

  @ApiProperty({ example: 'Grande salle' })
  location!: string;

  @ApiProperty({ example: '09:00', description: 'Format HH:mm' })
  startTime!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Séquence repère à laquelle rattacher cette branche parallèle',
  })
  anchorSequenceId?: number | null;
}

export class DocumentLinkDto implements ProgramDocumentLink {
  @ApiProperty({ example: 'Run of show' })
  label!: string;

  @ApiProperty({ example: 'https://drive.example.org/run-of-show' })
  url!: string;
}

export class UpdateSequenceDto {
  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;

  @ApiPropertyOptional({ nullable: true })
  volunteerTeamId?: number | null;

  @ApiPropertyOptional({ nullable: true })
  minDurationMinutes?: number | null;

  @ApiPropertyOptional({ nullable: true })
  minMarginMinutes?: number | null;

  @ApiPropertyOptional({ type: [Number] })
  missionIds?: number[];

  @ApiPropertyOptional({ type: [DocumentLinkDto] })
  documentLinks?: DocumentLinkDto[];

  @ApiPropertyOptional({ enum: ProgramSequenceTrack })
  track?: ProgramSequenceTrack;
  @ApiPropertyOptional({ enum: ProgramSequenceVisibility })
  visibility?: ProgramSequenceVisibility;
}

export class ChangeLogQueryDto {
  @ApiPropertyOptional({ example: '2027-10-31' })
  date?: string;
}

export interface ProgramSequenceView {
  id: number;
  eventDate: string;
  location: string;
  title: string;
  track: ProgramSequenceTrack;
  startTime: string;
  durationMinutes: number;
  endTime: string;
  status: ProgramSequenceStatus;
  visibility: ProgramSequenceVisibility;
  minDurationMinutes: number | null;
  minMarginMinutes: number | null;
  previousSequenceId: number | null;
  anchorSequenceId: number | null;
  volunteerTeamId: number | null;
  volunteerTeamName: string | null;
  missionIds: number[];
  documentLinks: ProgramDocumentLink[];
  notes: string | null;
  frozenByUserId: number | null;
  frozenByUserName: string | null;
  frozenAt: string | null;
}

export interface ProgramChangeLogView {
  id: number;
  action: ProgramChangeLogAction;
  eventDate: string;
  authorUserId: number;
  authorUserName: string | null;
  createdAt: string;
  affectedSequenceIds: number[];
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  comment: string | null;
}

export type ProgramRequestUser = { id: number; email: string; roles: string[] };
