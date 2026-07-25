import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { GroupsPage } from './groups';
@NgModule({
  declarations: [GroupsPage],
  imports: [SharedModule, RouterModule.forChild([{ path: '', component: GroupsPage }])],
})
export class GroupsModule {}
