import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
export class AccessReportQuery {
  @IsISO8601() from!: string;
  @IsISO8601() to!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) zoneId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) entryTypeId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) exitTypeId?: number;
}
export class ReviewListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) zoneId?: number;
}
export class CloseScanReviewDto {
  @IsString() @MinLength(3) @MaxLength(1000) note!: string;
}
