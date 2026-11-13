import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  AccessAuditLog,
  AccessBadge,
  AccessBadgeAssignment,
  AccessControlMeta,
  AccessScanEvent,
  AccessScanPoint,
  AccessScanSession,
  AccessScanType,
  AccessScannerGrant,
  AccessZone,
  Participant,
  User,
} from '../entities';
import { AccessAuditService } from './access-audit.service';
import { BadgesService } from './badges.service';
import { LookupRateLimiterService } from './lookup-rate-limiter.service';
import { ScanConfigService } from './scan-config.service';
import { ScannerGrantsService } from './scanner-grants.service';
import { ScanSessionsService } from './scan-sessions.service';
import { ScansService } from './scans.service';
import {
  AccessBadgesController,
  AccessConfigController,
  AccessGrantsController,
  AccessScanningController,
} from './access-control.controllers';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      AccessBadge,
      AccessBadgeAssignment,
      AccessScanType,
      AccessZone,
      AccessScanPoint,
      AccessScanSession,
      AccessScanEvent,
      AccessScannerGrant,
      AccessAuditLog,
      AccessControlMeta,
      Participant,
      User,
    ]),
  ],
  controllers: [
    AccessBadgesController,
    AccessConfigController,
    AccessGrantsController,
    AccessScanningController,
  ],
  providers: [
    AccessAuditService,
    BadgesService,
    ScanConfigService,
    ScannerGrantsService,
    ScanSessionsService,
    ScansService,
    LookupRateLimiterService,
  ],
  exports: [BadgesService, ScanConfigService, ScannerGrantsService],
})
export class AccessControlModule {}
