import { Component, input } from '@angular/core';
@Component({
  selector: 'app-page-layout',
  standalone: true,
  template: `<section class="page-layout">
    <header>
      <div>
        <h1>{{ title() }}</h1>
        <p>{{ description() }}</p>
      </div>
      <ng-content select="[actions]" />
    </header>
    <ng-content />
  </section>`,
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
})
export class PageLayoutComponent {
  readonly title = input.required<string>();
  readonly description = input('');
}
