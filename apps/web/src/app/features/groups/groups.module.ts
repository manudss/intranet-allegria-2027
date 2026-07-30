import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SHARED_IMPORTS } from '../../shared/shared.module';
import { GroupsPage } from './groups';
@NgModule({
  declarations: [GroupsPage],
  imports: [...SHARED_IMPORTS, RouterModule.forChild([{ path: '', component: GroupsPage }])],
})
export class GroupsModule {}
