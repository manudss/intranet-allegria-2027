import { Controller, Get, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { MejAgeGroup, ParticipantSex, VolunteerSkillType } from '../entities';
import { JeunesRepartitionService } from '../jeunes-repartition/jeunes-repartition.service';
import { TeamBenevolesService } from '../team-benevoles/team-benevoles.service';

class SelectionPageQuery {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsIn(['all', 'unassigned', 'assigned']) assignment?: 'all' | 'unassigned' | 'assigned';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 100;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}
export class SelectPrintParticipantsQuery extends SelectionPageQuery {
  @IsOptional() @IsIn(['all', 'JEUNE', 'ANIMATEUR']) type?: 'all' | 'JEUNE' | 'ANIMATEUR';
  @IsOptional() @IsEnum(MejAgeGroup) ageGroup?: MejAgeGroup;
  @IsOptional() @IsEnum(ParticipantSex) sex?: ParticipantSex;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) groupId?: number;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(120) diocese?: string;
}
export class SelectPrintVolunteersQuery extends SelectionPageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) poleId?: number;
  @IsOptional() @IsEnum(VolunteerSkillType) skill?: VolunteerSkillType;
  @IsOptional() @IsString() @MaxLength(120) tag?: string;
}
/** Reuse the assignment selectors, including their minor privacy rules. Read-only: no badge or projection is created here. */
@Controller('access-control/printing/selection')
@UseGuards(AuthTokenGuard, RoleGuard)
@Roles('ADMIN', 'BADGE_MANAGER')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class BadgeSelectionController {
  constructor(private readonly jeunes: JeunesRepartitionService, private readonly volunteers: TeamBenevolesService) {}
  @Get('participants/filters') participantFilters() { return this.jeunes.repartitionFilters(); }
  @Get('participants') participants(@Query() query: SelectPrintParticipantsQuery) { return this.jeunes.searchParticipants(query); }
  @Get('volunteers/filters') async volunteerFilters() {
    const { poles, skills, tags } = await this.volunteers.repartitionFilters();
    return { poles, skills, tags };
  }
  @Get('volunteers') volunteerRows(@Query() query: SelectPrintVolunteersQuery) { return this.volunteers.searchRepartitionVolunteers(query); }
}
