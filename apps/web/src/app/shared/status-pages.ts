import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
@Component({
  standalone: true,
  imports: [RouterLink, TuiButton],
  template: `<main class="status">
    <h1>Accès refusé</h1>
    <p>Votre rôle ne permet pas d'accéder à ces données.</p>
    <a tuiButton routerLink="/accueil">Retour à l'accueil</a>
  </main>`,
  styles: [
    `
      .status {
        max-width: 36rem;
        margin: 12vh auto;
        padding: 2rem;
        text-align: center;
      }
    `,
  ],
})
export class UnauthorizedPage {}
