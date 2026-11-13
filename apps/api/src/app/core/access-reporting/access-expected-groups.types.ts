import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PersonType } from '../entities/person-type.enum';

export class ExpectedGroupSourceDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) teamId?: number;
  @IsOptional() @IsEnum(PersonType) personType?: PersonType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) participantId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) volunteerId?: number;
}
export class SaveExpectedGroupDto {
  @IsString() @MinLength(1) @MaxLength(150) name!: string;
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ExpectedGroupSourceDto)
  sources!: ExpectedGroupSourceDto[];
  @IsOptional() @IsInt() @Min(1) version?: number;
  @IsOptional() @IsBoolean() archived?: boolean;
}
export class SaveExpectedPassageDto {
  @IsInt() @Min(1) groupId!: number;
  @IsInt() @Min(1) pointId!: number;
  @IsInt() @Min(1) scanTypeId!: number;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) serviceKey?: string;
  @IsString() @MinLength(1) @MaxLength(150) label!: string;
  @IsISO8601() startsAt!: string;
  @IsISO8601() endsAt!: string;
  @IsString() @MinLength(1) @MaxLength(80) timezone!: string;
  @IsOptional() @IsInt() @Min(1) version?: number;
  @IsOptional() @IsBoolean() archived?: boolean;
}
export class ExpectedPageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset = 0;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional()
  @IsEnum({ CONFIRMED: 'CONFIRMED', REVIEW_ONLY: 'REVIEW_ONLY', NOT_CONFIRMED: 'NOT_CONFIRMED' })
  status?: string;
}
