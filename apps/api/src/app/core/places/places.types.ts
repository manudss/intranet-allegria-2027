import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PlaceKind } from '../entities/place-kind.enum';
import { ProgramSequenceTrack } from '../entities/program-sequence-track.enum';

export class CreatePlaceDto {
  @IsString() @MinLength(1) @MaxLength(150) name!: string;
  @IsOptional() @IsEnum(PlaceKind) kind?: PlaceKind;
  @IsOptional() @IsEnum(ProgramSequenceTrack) track?: ProgramSequenceTrack;
  @IsOptional() @IsString() @MaxLength(255) address?: string | null;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string | null;
  @IsOptional() @IsString() @MaxLength(120) city?: string | null;
  @IsOptional() @IsString() @MaxLength(80) country?: string | null;
  @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number | null;
  @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number | null;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) practicalInfo?: string | null;
  @IsOptional() @IsInt() responsibleVolunteerId?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdatePlaceDto extends CreatePlaceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(150) declare name: string;
}

export class RoomDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
}

export class SetTeamsDto {
  @IsArray() @ArrayMaxSize(200) @IsInt({ each: true }) volunteerTeamIds!: number[];
}

export class PlaceListQuery {
  @IsOptional() @IsEnum(PlaceKind) kind?: PlaceKind;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}

/** Résultat de résolution d'un lieu et d'une salle choisis (utilisé par les modules rattachés). */
export type ResolvedLocation = { placeId: number | null; roomId: number | null; text: string | null };
