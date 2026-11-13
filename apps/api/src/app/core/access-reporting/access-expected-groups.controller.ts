import { AccessReportQuery } from './access-reporting.types';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { AccessExpectedGroupsService } from './access-expected-groups.service';
import {
  ExpectedPageQuery,
  SaveExpectedGroupDto,
  SaveExpectedPassageDto,
} from './access-expected-groups.types';
@Controller('access-control/expected')
@UseGuards(AuthTokenGuard, RoleGuard)
@Roles('ADMIN', 'BADGE_MANAGER')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class AccessExpectedGroupsController {
  constructor(private readonly service: AccessExpectedGroupsService) {}
  @Get('dashboard') dashboard(@Query() q: AccessReportQuery) {
    return this.service.dashboard(q.from, q.to);
  }
  @Get('groups') groups(@Query() q: ExpectedPageQuery) {
    return this.service.groups(q);
  }
  @Get('groups/:id') group(@Param('id', ParseIntPipe) id: number) {
    return this.service.group(id);
  }
  @Get('groups/:id/members') members(
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ExpectedPageQuery,
  ) {
    return this.service.members(id, q);
  }
  @Post('groups') create(@Body() dto: SaveExpectedGroupDto, @Req() req: { user: { id: number } }) {
    return this.service.saveGroup(null, dto, req.user.id);
  }
  @Put('groups/:id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveExpectedGroupDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.service.saveGroup(id, dto, req.user.id);
  }
  @Get('passages') passages(@Query() q: ExpectedPageQuery) {
    return this.service.passages(q);
  }
  @Post('passages') createPassage(
    @Body() dto: SaveExpectedPassageDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.service.savePassage(null, dto, req.user.id);
  }
  @Put('passages/:id') updatePassage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveExpectedPassageDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.service.savePassage(id, dto, req.user.id);
  }
  @Get('passages/:id/status') status(
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ExpectedPageQuery,
  ) {
    return this.service.status(id, q);
  }
}
