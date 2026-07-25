import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { TeamsPage } from './teams';
@NgModule({
  declarations: [TeamsPage],
  imports: [SharedModule, FormsModule, RouterModule.forChild([{ path: '', component: TeamsPage }])],
})
export class TeamsModule {}
