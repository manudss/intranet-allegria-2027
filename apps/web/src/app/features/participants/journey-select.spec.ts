import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SHARED_IMPORTS } from '../../shared/shared-imports';

/**
 * Même motif que les sélecteurs Délégation / Sous-délégation de la fiche
 * participant : tuiSelect alimenté par [items] + [stringify]. Vérifie le rendu
 * réel : la valeur courante préremplie est affichée.
 */
@Component({
  selector: 'app-journey-select-host',
  imports: [SHARED_IMPORTS],
  template: `<tui-textfield tuiChevron [stringify]="label">
    <label for="j-del-ALLER" tuiLabel>Délégation</label>
    <select
      tuiSelect
      id="j-del-ALLER"
      [items]="ids()"
      [ngModel]="current()"
      [ngModelOptions]="{ standalone: true }"
    ></select>
  </tui-textfield>`,
})
class HostComponent {
  readonly rows = signal([
    { id: 1, name: 'Délégation de Lyon' },
    { id: 2, name: 'Délégation de Annecy' },
  ]);
  readonly ids = computed(() => this.rows().map((r) => r.id));
  readonly current = signal<number | null>(2);
  readonly label = (id: number | null) => this.rows().find((r) => r.id === id)?.name ?? '';
}

describe('sélecteur de la fiche participant (rendu réel)', () => {
  it('affiche la valeur courante préremplie', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('select#j-del-ALLER') as HTMLSelectElement;
    expect(el).toBeTruthy();
    expect(el.value + (fixture.nativeElement as HTMLElement).textContent).toContain('Annecy');
  });
});
