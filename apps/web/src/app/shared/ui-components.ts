import { Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PAGE_HELP } from './page-help';
import { TuiNavigation } from "@taiga-ui/layout";
import { TuiTitle } from "@taiga-ui/core";
@Component({
  selector: 'app-page-layout',
  standalone: true,
  template: `
    <main tuiNavigationMain class="page-layout">
      <header tuiSubheader>
        <div tuiTitle>
          <h1>{{ title() }}</h1>
          @if (purpose()) {
            <p tuiSubtitle class="page-purpose">{{ purpose() }}</p>
          }
        </div>
        <ng-content select="[actions]"/>
      </header>
      <section>
        <ng-content/>
      </section>
    </main>`,
  styles: [
    `
      :host {
        display: block;
      }

      .page-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-auto-flow: row;
        align-items: start;
        gap: 1rem;
        min-inline-size: 0;
      }

      .page-layout > header {
        display: flex;
        min-inline-size: 0;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .page-layout h1 {
        margin: 0;
        color: var(--allegria-primary);
      }

      .page-layout p {
        margin: 0.25rem 0 0;
        color: var(--allegria-muted);
      }
    `,
  ],
  imports: [
    TuiNavigation,
    TuiTitle
  ]
})
export class PageLayoutComponent {
  readonly title = input.required<string>();
  readonly description = input('');

  private readonly route = inject(ActivatedRoute, { optional: true });

  /** Phrase « À quoi sert cette page » : celle de la page, sinon celle du gabarit commun. */
  protected readonly purpose = computed(() => {
    const own = this.description().trim();
    if (own) return own;
    const path = this.route?.snapshot?.routeConfig?.path ?? '';
    return PAGE_HELP[path]?.purpose ?? '';
  });
}
