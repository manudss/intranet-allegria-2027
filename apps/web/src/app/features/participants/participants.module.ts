import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ParticipantsPage } from './participants';
@NgModule({
  declarations: [ParticipantsPage],
  imports: [
    SharedModule,
    FormsModule,
    RouterModule.forChild([{ path: '', component: ParticipantsPage }]),
  ],
})
export class ParticipantsModule {}
