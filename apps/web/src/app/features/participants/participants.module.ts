import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SHARED_IMPORTS } from '../../shared/shared.module';
import { ParticipantsPage } from './participants';
@NgModule({
  declarations: [ParticipantsPage],
  imports: [
    ...SHARED_IMPORTS,
    FormsModule,
    RouterModule.forChild([{ path: '', component: ParticipantsPage }]),
  ],
})
export class ParticipantsModule {}
