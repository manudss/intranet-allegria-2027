import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SHARED_IMPORTS } from '../../shared/shared.module';
import { AssignmentsPage } from './assignments';
@NgModule({
  declarations: [AssignmentsPage],
  imports: [...SHARED_IMPORTS, RouterModule.forChild([{ path: '', component: AssignmentsPage }])],
})
export class AssignmentsModule {}
