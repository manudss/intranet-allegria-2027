import { BadgeSelectionController } from './badge-selection.controller';
import { JeunesRepartitionModule } from '../jeunes-repartition/jeunes-repartition.module';
import { TeamBenevolesModule } from '../team-benevoles/team-benevoles.module';
import { BadgePrintService } from './badge-print.service';
import { BadgePrintController } from './badge-print.controller';
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
    JeunesRepartitionModule,
    TeamBenevolesModule,
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
    BadgePrintController,
    BadgeSelectionController,
    AccessBadgesController,
    AccessConfigController,
    AccessGrantsController,
    AccessScanningController,
  ],
  providers: [
    BadgePrintService,
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
