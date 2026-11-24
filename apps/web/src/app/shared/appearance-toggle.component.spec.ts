import { TestBed } from '@angular/core/testing';
import { AppearanceService } from '@mej-allegria/appearance';
import { describe, expect, it } from 'vitest';
import { AppearanceToggleComponent } from './appearance-toggle.component';

describe('AppearanceToggleComponent', () => {
  it('passe auto, clair, sombre puis auto, avec un libellé accessible', () => {
    localStorage.clear();
    const fixture = TestBed.createComponent(AppearanceToggleComponent);
    const service = TestBed.inject(AppearanceService);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(service.mode()).toBe('auto');
    expect(button.getAttribute('aria-label')).toContain('Automatique');
    button.click();
    fixture.detectChanges();
    expect(service.mode()).toBe('light');
    expect(button.getAttribute('aria-label')).toContain('Clair');
    button.click();
    expect(service.mode()).toBe('dark');
    button.click();
    expect(service.mode()).toBe('auto');
  });
});
