import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import {
  AccessModule,
  AccessScope,
  AccessScopeInfo,
  GroupScopeAware,
} from '../auth/access-module.decorator';
import { PersonType } from '../entities';
import { BadgePrintService } from './badge-print.service';
export class PrintPeopleQuery {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsEnum(PersonType) type?: PersonType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}
export class PreparePrintDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  participantIds: number[] = [];
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  volunteerIds: number[] = [];
}
@Controller('access-control/printing')
@UseGuards(AuthTokenGuard, RoleGuard)
@AccessModule('BADGES')
@GroupScopeAware()
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class BadgePrintController {
  constructor(private readonly service: BadgePrintService) {}
  @Get('participants') people(@Query() q: PrintPeopleQuery, @AccessScope() scope: AccessScopeInfo) {
    return this.service.people(q, scope);
  }
  @Post('participants/preview') preview(
    @Body() dto: PreparePrintDto,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.service.preview(dto.participantIds, dto.volunteerIds, scope);
  }
  @Post('participants/prepare') prepare(
    @Body() dto: PreparePrintDto,
    @Req() req: { user: { id: number } },
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.service.prepare(dto.participantIds, req.user.id, dto.volunteerIds, scope);
  }
}
