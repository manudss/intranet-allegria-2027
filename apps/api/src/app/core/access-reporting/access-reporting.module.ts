import { Body, Controller, Get, Module, Param, ParseIntPipe, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { AccessScanReview } from './access-scan-review.entity';
import { AccessReportingService } from './access-reporting.service';
import { AccessReportQuery, CloseScanReviewDto, ReviewListQuery } from './access-reporting.types';
@Controller('access-control/reporting')
@UseGuards(AuthTokenGuard, RoleGuard)
@Roles('ADMIN','BADGE_MANAGER')
@UsePipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}))
export class AccessReportingController {
  constructor(private readonly service: AccessReportingService) {}
  @Get('summary') summary(@Query() q:AccessReportQuery) {return this.service.summary(q);}
  @Get('reviews') reviews(@Query() q:ReviewListQuery) {return this.service.reviews(q);}
  @Post('reviews/:id/close') close(@Param('id',ParseIntPipe) id:number,@Body() dto:CloseScanReviewDto,@Req() req:{user:{id:number}}) {return this.service.closeReview(id,req.user.id,dto.note);}
}
@Module({imports:[AuthModule,TypeOrmModule.forFeature([AccessScanReview])],controllers:[AccessReportingController],providers:[AccessReportingService]})
export class AccessReportingModule {}
