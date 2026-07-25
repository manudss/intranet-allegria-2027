import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { HostFamiliesPage } from './host-families';
@NgModule({
  declarations: [HostFamiliesPage],
  imports: [SharedModule, RouterModule.forChild([{ path: '', component: HostFamiliesPage }])],
})
export class HostFamiliesModule {}
