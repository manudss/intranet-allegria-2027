import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessRightsController } from './access-rights.controller';

@Module({ imports: [AuthModule], controllers: [AccessRightsController] })
export class AccessRightsModule {}
