import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTaiga, TuiRoot } from '@taiga-ui/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { LoginComponent } from './login';

@Component({
  standalone: true,
  imports: [TuiRoot, LoginComponent],
  template: '<tui-root><app-login /></tui-root>',
})
class HostComponent {}

describe('LoginComponent : champs requis', () => {
  beforeAll(() => {
    // jsdom n'a pas matchMedia (utilisé par Taiga pour le mode sombre).
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => TestBed.resetTestingModule());

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideTaiga(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return fixture;
  }

  it("n'affiche ni erreur ni style d'erreur avant interaction", async () => {
    const fixture = await setup();
    const el: HTMLElement = fixture.nativeElement;
    const fields = el.querySelectorAll('tui-textfield');
    expect(fields.length).toBe(2);
    fields.forEach((f) => expect(f.classList.contains('field-pristine')).toBe(true));
    expect(el.textContent).not.toContain('requis');
    el.querySelectorAll('input').forEach((i) => {
      expect(i.getAttribute('aria-invalid')).toBe('false');
      expect(i.hasAttribute('aria-describedby')).toBe(false);
    });
    expect(el.querySelector('form')!.hasAttribute('novalidate')).toBe(true);
  });

  it("affiche les erreurs et retire le mode neutre après l'envoi à vide", async () => {
    const fixture = await setup();
    const el: HTMLElement = fixture.nativeElement;
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Adresse e-mail requise');
    expect(el.textContent).toContain('Mot de passe requis');
    for (const [inputId, errorId] of [['email', 'email-error'], ['password', 'password-error']]) {
      const input = el.querySelector(`#${inputId}`)!;
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe(errorId);
      expect(el.querySelector(`#${errorId}`)?.textContent).toContain('requis');
    }
    el.querySelectorAll('tui-textfield').forEach((f) =>
      expect(f.classList.contains('field-pristine')).toBe(false),
    );
  });

  it('libelle le champ « Adresse e-mail »', async () => {
    const fixture = await setup();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Adresse e-mail');
  });
});
