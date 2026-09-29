import { Component, inject, signal } from '@angular/core';
import { form, FormField, required, email, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { TuiButton, TuiError, TuiInput, TuiTextfield, TuiIcon } from '@taiga-ui/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { TuiPassword } from "@taiga-ui/kit";

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormField, TuiButton, TuiError, TuiTextfield, TuiInput, TuiPassword, TuiIcon],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly model = signal({ email: '', password: '' });
  readonly loginForm = form(this.model, (p) => {
    required(p.email);
    email(p.email);
    required(p.password);
  });
  readonly loading = signal(false);
  readonly error = signal('');
  onSubmit(event: Event) {
    event.preventDefault();
    submit(this.loginForm, async () => {
      this.loading.set(true);
      this.error.set('');
      this.auth
        .login(this.model())
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: () =>
            void this.router.navigateByUrl(
              this.route.snapshot.queryParamMap.get('returnUrl') ?? '/accueil',
            ),
          error: () => this.error.set('Email ou mot de passe invalide'),
        });
    });
  }
}
