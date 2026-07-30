import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SHARED_IMPORTS } from '../../shared/shared.module';
import { TeamsPage } from './teams';
@NgModule({
  declarations: [TeamsPage],
  imports: [...SHARED_IMPORTS, FormsModule, RouterModule.forChild([{ path: '', component: TeamsPage }])],
})
export class TeamsModule {}
