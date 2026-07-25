import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LoginComponent } from './login';
@NgModule({
  imports: [LoginComponent, RouterModule.forChild([{ path: '', component: LoginComponent }])],
})
export class AuthModule {}
