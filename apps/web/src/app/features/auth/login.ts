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
  template: `<main class="login">
    <section class="card">
      <img src="assets/logo-allegria.svg" alt="Allegria 2027" />
      <h1>Connexion</h1>
      <p>Intranet des bénévoles</p>
      <form (submit)="onSubmit($event)">
        <tui-textfield>
          <label tuiLabel for="email">Email</label>
          <input tuiInput type="email" autocomplete="username" [formField]="loginForm.email" id="email" />
        </tui-textfield>
        <tui-error
          [error]="
            loginForm.email().touched() && loginForm.email().invalid()
              ? 'Adresse email requise'
              : null
          "
        />
        <tui-textfield>
          <label tuiLabel for="password">Mot de passe</label>
          <input
            tuiInput
            type="password"
            autocomplete="current-password"
            [formField]="loginForm.password"
            id="password"
          />
          <tui-icon tuiPassword />
        </tui-textfield>
        <tui-error
          [error]="
            loginForm.password().touched() && loginForm.password().invalid()
              ? 'Mot de passe requis'
              : null
          "
        />
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button tuiButton appearance="primary" type="submit" [disabled]="loading()">
          {{ loading() ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>
    </section>
  </main>`,
  styles: [
    `
      .login {
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: var(--allegria-bg-alt);
        padding: 1rem;
      }
      .card {
        width: min(100%, 26rem);
        background: #fff;
        padding: 2rem;
        border-radius: 1rem;
        box-shadow: 0 1rem 3rem #0002;
      }
      .card img {
        width: 10rem;
      }
      .card h1 {
        margin: 1.5rem 0 0.25rem;
        color: var(--allegria-primary);
      }
      form {
        display: grid;
        gap: 0.75rem;
        margin-top: 1.5rem;
      }
      .error {
        color: var(--tui-status-negative);
        margin: 0;
      }
    `,
  ],
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
