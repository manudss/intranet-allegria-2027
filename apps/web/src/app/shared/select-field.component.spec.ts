import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SelectFieldComponent } from './select-field.component';

describe('SelectFieldComponent', () => {
  it('rend un composant Taiga UI (tuiSelect) et pas un select natif', async () => {
    await TestBed.configureTestingModule({ imports: [SelectFieldComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SelectFieldComponent<number>);
    fixture.componentRef.setInput('label', 'Groupe');
    fixture.componentRef.setInput('testId', 'g');
    fixture.componentRef.setInput('options', [
      { value: 0, label: 'Aucun groupe' },
      { value: 4, label: 'Nord' },
    ]);
    fixture.componentRef.setInput('value', 4);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('tui-textfield')).not.toBeNull();
    expect(el.querySelector('select')).toBeNull();
    expect(el.querySelector('input[data-testid="g"]')).not.toBeNull();
  });
});
