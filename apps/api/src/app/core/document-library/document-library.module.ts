import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import {
  DocumentCategory,
  DocumentLink,
  DocumentLinkTeam,
  Volunteer,
  VolunteerTeam,
  VolunteerTeamMembership,
} from '../entities';
import { DocumentLibraryController } from './document-library.controller';
import { DocumentLibraryService } from './document-library.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentLink,
      DocumentLinkTeam,
      DocumentCategory,
      Volunteer,
      VolunteerTeam,
      VolunteerTeamMembership,
    ]),
    AuthModule,
  ],
  controllers: [DocumentLibraryController],
  providers: [DocumentLibraryService],
  exports: [DocumentLibraryService],
})
export class DocumentLibraryModule {}
