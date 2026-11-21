import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type Appearance = 'light' | 'dark' | 'auto';
export const APPEARANCE_KEY = 'alegria.appearance.v1';
export function validAppearance(value: unknown): Appearance {
  return value === 'light' || value === 'dark' ? value : 'auto';
}
export function resolveAppearance(mode: Appearance, systemDark: boolean): boolean {
  return mode === 'dark' || (mode === 'auto' && systemDark);
}

@Injectable({ providedIn: 'root' })
export class AppearanceService {
  private readonly doc = inject(DOCUMENT);
  private readonly destroy = inject(DestroyRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly mode = signal<Appearance>('auto');
  readonly dark = Object.assign(signal(false), { reset: () => this.choose('auto') });
  private media?: MediaQueryList;

  constructor() {
    if (!this.browser) return;
    const win = this.doc.defaultView;
    if (!win) return;
    try { this.mode.set(validAppearance(win.localStorage.getItem(APPEARANCE_KEY))); } catch { /* Private/storage-disabled browsing still works. */ }
    this.media = win.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => this.apply();
    const storage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_KEY || event.key === null) {
        this.mode.set(validAppearance(event.newValue)); this.apply();
      }
    };
    this.media?.addEventListener('change', update);
    win.addEventListener('storage', storage);
    this.destroy.onDestroy(() => {
      this.media?.removeEventListener('change', update);
      win.removeEventListener('storage', storage);
    });
    this.apply();
  }

  choose(value: Appearance): void {
    this.mode.set(validAppearance(value));
    if (this.browser) {
      try { this.doc.defaultView?.localStorage.setItem(APPEARANCE_KEY, this.mode()); } catch { /* Keep in-memory choice. */ }
    }
    this.apply();
  }

  private apply(): void {
    const dark = resolveAppearance(this.mode(), this.media?.matches ?? false);
    this.dark.set(dark);
    if (!this.browser) return;
    this.doc.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
    this.doc.documentElement.style.colorScheme = dark ? 'dark' : 'only light';
    this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#201a18' : '#fffdf9');
  }
}
