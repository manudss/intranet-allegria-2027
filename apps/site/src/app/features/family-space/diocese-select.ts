import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { DIOCESES } from '@mej-allegria/shared';
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
export const DIOCESE_CHOICES = [
  { id: 'UNKNOWN', name: 'Je ne sais pas' },
  { id: 'OTHER', name: 'Autre pays / autre juridiction' },
  ...DIOCESES,
];
@Component({
  selector: 'app-diocese-select',
  template: `
    <label id="diocese-label" for="diocese-trigger">Diocèse ou juridiction</label>
    <div class="select-shell" (focusout)="leave($event)">
      <button
        id="diocese-trigger"
        type="button"
        class="select-trigger"
        [disabled]="disabled()"
        aria-labelledby="diocese-label diocese-value"
        aria-haspopup="dialog"
        [attr.aria-expanded]="opened()"
        aria-controls="diocese-picker"
        (click)="toggle()"
        (keydown.arrowdown)="show($event)"
        (keydown.arrowup)="show($event)"
      >
        <span id="diocese-value">{{ label() }}</span
        ><span aria-hidden="true">⌄</span>
      </button>
      @if (opened()) {
        <div id="diocese-picker" class="picker" role="dialog" aria-labelledby="diocese-label">
          <label class="search-label" for="diocese-query">Rechercher dans la liste</label>
          <input
            id="diocese-query"
            type="text"
            role="combobox"
            autocomplete="off"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="diocese-options"
            [attr.aria-activedescendant]="options().length ? 'diocese-option-' + active() : null"
            [value]="query()"
            (input)="search($any($event.target).value)"
            (keydown)="key($event)"
            placeholder="Nom du diocèse…"
          />
          <p class="count" aria-live="polite">{{ options().length }} résultat(s)</p>
          <ul id="diocese-options" role="listbox" aria-labelledby="diocese-label">
            @for (option of options(); track option.id; let i = $index) {
              <li
                role="option"
                tabindex="-1"
                (keydown.enter)="choose(option.id)"
                [id]="'diocese-option-' + i"
                [attr.aria-selected]="value() === option.id"
                [class.active]="active() === i"
                (pointerdown)="$event.preventDefault()"
                (click)="choose(option.id)"
              >
                {{ option.name }}
                @if (value() === option.id) {
                  <span aria-hidden="true"> ✓</span>
                }
              </li>
            }
          </ul>
          @if (!options().length) {
            <p>Aucun résultat. Essayez un autre nom.</p>
          }
          <button type="button" class="close-picker" (click)="close()">Fermer la liste</button>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    label {
      display: block;
      font-weight: 700;
      margin: 0.75rem 0 0.35rem;
    }
    .select-shell {
      position: relative;
    }
    button,
    input {
      font: inherit;
      color: inherit;
    }
    .select-trigger {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      width: 100%;
      min-height: 48px;
      text-align: left;
      background: #fff;
      border: 1px solid #806f64;
      border-radius: 0.4rem;
      padding: 0.75rem;
      white-space: normal;
    }
    .picker {
      position: relative;
      border: 2px solid #806f64;
      border-radius: 0.4rem;
      padding: 0.75rem;
      background: #fff;
      margin-top: 0.35rem;
      min-width: 0;
    }
    input {
      display: block;
      box-sizing: border-box;
      width: 100%;
      min-height: 48px;
      border: 1px solid #806f64;
      border-radius: 0.3rem;
      padding: 0.6rem;
    }
    .search-label {
      margin-top: 0;
    }
    .count {
      font-size: 0.9rem;
      margin: 0.5rem 0;
      color: #55483e;
    }
    ul {
      list-style: none;
      margin: 0.5rem 0;
      padding: 0;
      max-height: 15rem;
      overflow: auto;
      overscroll-behavior: contain;
      border: 1px solid #d3c6bb;
      border-radius: 0.3rem;
    }
    li {
      padding: 0.75rem;
      min-height: 44px;
      box-sizing: border-box;
      cursor: pointer;
      border-bottom: 1px solid #ece3db;
    }
    li.active {
      background: #f2e7d9;
      outline: 2px solid #254c8c;
      outline-offset: -2px;
    }
    li[aria-selected='true'] {
      font-weight: 700;
    }
    .close-picker {
      background: #fff;
      border: 1px solid #806f64;
      border-radius: 0.3rem;
      padding: 0.6rem 0.9rem;
      min-height: 44px;
    }
    button:focus-visible,
    input:focus-visible {
      outline: 3px solid #254c8c;
      outline-offset: 2px;
    }
    button:disabled {
      opacity: 0.75;
      cursor: not-allowed;
    }
  `,
})
export class DioceseSelect {
  readonly value = input('');
  readonly disabled = input(false);
  readonly selected = output<string>();
  protected readonly opened = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly options = computed(() =>
    DIOCESE_CHOICES.filter((d) => normalize(d.name).includes(normalize(this.query()))),
  );
  protected readonly label = computed(
    () => DIOCESE_CHOICES.find((d) => d.id === this.value())?.name || 'Choisir dans la liste',
  );
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected toggle() {
    if (this.opened()) this.close();
    else this.show();
  }
  protected show(event?: Event) {
    event?.preventDefault();
    if (this.disabled()) return;
    this.query.set('');
    this.active.set(
      Math.max(
        0,
        DIOCESE_CHOICES.findIndex((d) => d.id === this.value()),
      ),
    );
    this.opened.set(true);
    setTimeout(() => {
      if (!this.opened()) return;
      this.host.nativeElement.querySelector<HTMLInputElement>('#diocese-query')?.focus();
      this.scrollActive();
    });
  }
  protected search(value: string) {
    this.query.set(value);
    this.active.set(0);
  }
  protected choose(id: string) {
    if (this.disabled()) return;
    this.selected.emit(id);
    this.close();
  }
  protected close() {
    this.opened.set(false);
    this.host.nativeElement.querySelector<HTMLButtonElement>('#diocese-trigger')?.focus();
  }
  protected leave(event: FocusEvent) {
    if (!this.host.nativeElement.contains(event.relatedTarget as Node | null))
      this.opened.set(false);
  }
  private scrollActive() {
    this.host.nativeElement
      .querySelector('#diocese-option-' + this.active())
      ?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
  }
  protected key(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = this.options()[this.active()];
      if (option) this.choose(option.id);
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const last = Math.max(0, this.options().length - 1);
      this.active.set(
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : Math.min(last, Math.max(0, this.active() + (event.key === 'ArrowDown' ? 1 : -1))),
      );
      this.scrollActive();
    }
  }
}
