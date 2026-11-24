import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RequiredFieldDirective } from './required-field.directive';

@Component({
  imports: [RequiredFieldDirective],
  template: `<form>
    <tui-textfield><input id="a" required /></tui-textfield>
    <button type="button">Enregistrer</button>
  </form>`,
})
class HostComponent {}

describe('RequiredFieldDirective', () => {
  const flush = () => new Promise((r) => setTimeout(r, 5));
  it('reste neutre puis signale le champ obligatoire vide après validation', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await flush();
    const el: HTMLElement = fixture.nativeElement;
    const field = el.querySelector('tui-textfield') as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;
    expect(field.classList.contains('field-required')).toBe(true);
    expect(field.classList.contains('field-pristine')).toBe(true);
    expect(el.querySelector('.field-error-message')).toBeNull();
    (el.querySelector('button') as HTMLButtonElement).click();
    await flush();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const msg = el.querySelector('.field-error-message') as HTMLElement;
    expect(msg.textContent).toBe('Champ obligatoire');
    expect(input.getAttribute('aria-describedby')).toBe(msg.id);
    input.value = 'Léa';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(el.querySelector('.field-error-message')).toBeNull();
  });
});
