import { RegistrationDocumentsService } from './registration-documents.service';
import { RegistrationHealthService } from './registration-health.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { RegistrationFamily } from '../entities/registration-family.entity';
import { Participant } from '../entities';
import { AuthModule } from '../auth/auth.module';
import { FamilyRegistrationService } from './family-registration.service';
import {
  FamilyRegistrationController,
  FamilyRegistrationStaffController,
  CateringNeedsController,
  FamilyHealthStaffController,
} from './family-registration.controller';
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([RegistrationFamily, Participant]),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 120 }]),
  ],
  controllers: [
    FamilyRegistrationController,
    FamilyRegistrationStaffController,
    CateringNeedsController,
    FamilyHealthStaffController,
  ],
  providers: [FamilyRegistrationService, RegistrationHealthService, RegistrationDocumentsService],
})
export class FamilyRegistrationModule {}
