import { Type } from 'class-transformer';
import { IsIn, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AccessReportQuery } from './access-reporting.types';
import { PersonType } from '../entities/person-type.enum';
import { AccessScanVerdict } from '../entities/access-scan-verdict.enum';

export class ReportDetailQuery extends AccessReportQuery {
  @IsOptional() @IsIn(['true', 'false']) withoutAcceptedOnly?: string;
  @IsOptional() @IsIn(['true', 'false']) anomaliesOnly?: string;
  @IsOptional() @IsIn(['true', 'false']) reviewOnly?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pointId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) scanTypeId?: number;
  @IsOptional() @IsString() @MaxLength(120) serviceKey?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) participantId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) expectedGroupId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) teamId?: number;
  @IsOptional() @IsEnum(PersonType) personType?: PersonType;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsEnum(AccessScanVerdict) verdict?: AccessScanVerdict;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset = 0;
}
