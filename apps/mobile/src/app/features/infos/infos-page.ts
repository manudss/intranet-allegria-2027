import { Component } from '@angular/core';
import { InfosComponent } from './infos';

@Component({
  selector: 'app-infos-page',
  standalone: true,
  imports: [InfosComponent],
  template: `
    <header class="hero">
      <span class="brand">ALEGRIA</span>
      <h1>Infos pratiques</h1>
    </header>
    <app-infos />
  `,
  styles: [
    `
      .hero {
        background: var(--allegria-primary);
        color: var(--allegria-on-primary);
        padding: 1.25rem 1.25rem 1.5rem;
        border-radius: 0 0 1.5rem 1.5rem;
      }
      .brand {
        font-weight: 800;
        letter-spacing: 0.12em;
        font-size: 0.9rem;
      }
      .hero h1 {
        margin: 0.5rem 0 0;
        font-size: 1.5rem;
      }
    `,
  ],
})
export class InfosPageComponent {}
