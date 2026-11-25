import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { AccessModule, AccessLevelRequired } from '../auth/access-module.decorator';
import { ExpectedScanPolicyService } from './expected-scan-policy.service';
export class CreateExceptionGrantDto {
  @IsInt() @Min(1) userId!: number;
  @IsInt() @Min(1) pointId!: number;
}
export class AuthorizeExceptionDto {
  @IsInt() @Min(1) eventId!: number;
  @IsInt() @Min(1) passageId!: number;
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
  @IsString() @MinLength(8) @MaxLength(80) operationId!: string;
}
@Controller('access-control')
@UseGuards(AuthTokenGuard, RoleGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class ExpectedScanPolicyController {
  constructor(private readonly policy: ExpectedScanPolicyService) {}
  @AccessModule('BADGES')
  @Get('exception-grants')
  grants() {
    return this.policy.grants();
  }
  @AccessModule('BADGES')
  @Post('exception-grants')
  grant(@Body() d: CreateExceptionGrantDto, @Req() r: { user: { id: number } }) {
    return this.policy.grant(d.userId, d.pointId, r.user.id);
  }
  @AccessModule('BADGES')
  @Post('exception-grants/:id/revoke')
  revoke(@Param('id', ParseIntPipe) id: number, @Req() r: { user: { id: number } }) {
    return this.policy.revoke(id, r.user.id);
  }
  @AccessModule('SCAN')
  @AccessLevelRequired('EDIT')
  @Post('scan/sessions/:id/exceptions')
  override(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: AuthorizeExceptionDto,
    @Req() r: { user: { id: number } },
  ) {
    return this.policy.override(id, r.user.id, d.eventId, d.passageId, d.reason, d.operationId);
  }
}
