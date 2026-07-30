import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SHARED_IMPORTS } from '../../shared/shared.module';
import { VolunteersPage } from './volunteers';
@NgModule({
  declarations: [VolunteersPage],
  imports: [...SHARED_IMPORTS, RouterModule.forChild([{path: '', component: VolunteersPage}])],
})
export class VolunteersModule {}
