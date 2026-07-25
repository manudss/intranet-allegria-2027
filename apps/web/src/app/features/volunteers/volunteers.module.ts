import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { VolunteersPage } from './volunteers';
@NgModule({
  declarations: [VolunteersPage],
  imports: [SharedModule, RouterModule.forChild([{ path: '', component: VolunteersPage }])],
})
export class VolunteersModule {}
