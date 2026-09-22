import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User, VolunteerAuditLog } from '../entities';
import { AuditContextInterceptor } from './audit-context.interceptor';
import { AuditContextService } from './audit-context.service';
import { VolunteerAuditLogSubscriber } from './volunteer-audit-log.subscriber';
import { VolunteerAuditLogsController } from './volunteer-audit-logs.controller';
import { VolunteerAuditLogsService } from './volunteer-audit-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([VolunteerAuditLog, User]), AuthModule],
  controllers: [VolunteerAuditLogsController],
  providers: [
    VolunteerAuditLogsService,
    VolunteerAuditLogSubscriber,
    AuditContextService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditContextInterceptor,
    },
  ],
  exports: [VolunteerAuditLogsService],
})
export class VolunteerAuditLogsModule {}
