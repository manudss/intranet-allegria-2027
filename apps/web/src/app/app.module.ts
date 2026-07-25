import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { provideTaiga, TuiButton, TuiIcon, TuiLink, TuiRoot, TuiScrollbar } from '@taiga-ui/core';
import { App } from './app';
import { AppRoutingModule } from './app-routing.module';
import { AuthInterceptor } from './core/auth.interceptor';
import { HttpErrorInterceptor } from './core/http-error.interceptor';
import { Layout } from './layout';

@NgModule({
  declarations: [App, Layout],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TuiRoot,
    TuiButton,
    TuiIcon,
    TuiLink,
    TuiScrollbar,
  ],
  providers: [
    provideTaiga(),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true },
  ],
  bootstrap: [App],
})
export class AppModule {}
