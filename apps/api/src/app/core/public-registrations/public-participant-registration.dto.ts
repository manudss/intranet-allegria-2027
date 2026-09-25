import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import type {
  PublicMejAgeGroup,
  PublicParentContact,
  PublicParticipantEntry,
  PublicParticipantRegistrationPayload,
  PublicParticipantSex,
} from '@mej-allegria/shared';

const PARTICIPANT_SEX_VALUES: PublicParticipantSex[] = [
  'FEMALE',
  'MALE',
  'OTHER',
  'UNDISCLOSED',
];
const MEJ_AGE_GROUP_VALUES: PublicMejAgeGroup[] = ['TA', 'ES'];

export class PublicParentContactDto implements PublicParentContact {
  @ApiProperty({ example: 'Sophie Durand' })
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiProperty({ example: '+33601020304' })
  @IsString()
  @MaxLength(40)
  phone!: string;

  @ApiPropertyOptional({ example: 'sophie.durand@example.fr' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export class PublicParticipantEntryDto implements PublicParticipantEntry {
  @ApiProperty({ example: 'Marie' })
  @IsString()
  @MaxLength(120)
  firstName!: string;

  @ApiProperty({ example: 'Durand' })
  @IsString()
  @MaxLength(120)
  lastName!: string;

  @ApiProperty({ example: '2011-03-19', description: 'Format ISO date (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  dateOfBirth!: string;

  @ApiProperty({ enum: PARTICIPANT_SEX_VALUES, example: 'FEMALE' })
  @IsIn(PARTICIPANT_SEX_VALUES)
  sex!: PublicParticipantSex;

  @ApiProperty({ enum: MEJ_AGE_GROUP_VALUES, example: 'TA' })
  @IsIn(MEJ_AGE_GROUP_VALUES)
  mejAgeGroup!: PublicMejAgeGroup;

  @ApiPropertyOptional({ example: 'Lyon' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  diocese?: string;

  @ApiPropertyOptional({ example: 'Villeurbanne' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'Sophie Durand' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '+33601020304' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  emergencyContactPhone?: string;
}

export class CreatePublicParticipantRegistrationDto implements PublicParticipantRegistrationPayload {
  @ApiPropertyOptional({ type: PublicParentContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicParentContactDto)
  parentContact?: PublicParentContactDto;

  @ApiProperty({ type: [PublicParticipantEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PublicParticipantEntryDto)
  participants!: PublicParticipantEntryDto[];

  /** Champ honeypot : ne doit jamais être rempli par un humain. */
  @ApiPropertyOptional({ description: "Champ anti-bot, doit rester vide" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  honeypot?: string;
}
