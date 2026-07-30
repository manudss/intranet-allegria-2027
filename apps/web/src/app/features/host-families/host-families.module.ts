import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SHARED_IMPORTS } from '../../shared/shared.module';
import { HostFamiliesPage } from './host-families';
@NgModule({
  declarations: [HostFamiliesPage],
  imports: [...SHARED_IMPORTS, RouterModule.forChild([{ path: '', component: HostFamiliesPage }])],
})
export class HostFamiliesModule {}
