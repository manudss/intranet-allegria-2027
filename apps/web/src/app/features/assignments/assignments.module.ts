import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { AssignmentsPage } from './assignments';
@NgModule({
  declarations: [AssignmentsPage],
  imports: [SharedModule, RouterModule.forChild([{ path: '', component: AssignmentsPage }])],
})
export class AssignmentsModule {}
