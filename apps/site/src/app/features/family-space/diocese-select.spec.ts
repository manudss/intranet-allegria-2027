import { TestBed } from '@angular/core/testing';
import { DIOCESES } from '@mej-allegria/shared';
import { DioceseSelect } from './diocese-select';
describe('Integrated searchable diocese selector', () => {
  const originalScroll = Element.prototype.scrollIntoView;
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    Element.prototype.scrollIntoView = originalScroll;
  });
  afterEach(() => TestBed.resetTestingModule());
  async function setup(value = '') {
    TestBed.configureTestingModule({ imports: [DioceseSelect] });
    const f = TestBed.createComponent(DioceseSelect);
    f.componentRef.setInput('value', value);
    f.detectChanges();
    await f.whenStable();
    return f;
  }
  it('starts with one selector and puts the search inside its expanded list, preserving all108entries', async () => {
    const f = await setup();
    expect(f.nativeElement.querySelector('input')).toBeNull();
    f.nativeElement.querySelector('#diocese-trigger').click();
    f.detectChanges();
    await f.whenStable();
    expect(f.nativeElement.querySelector('[role=dialog] input[role=combobox]')).not.toBeNull();
    expect(f.nativeElement.querySelectorAll('[role=option]')).toHaveLength(DIOCESES.length + 2);
    expect(f.nativeElement.querySelector('#diocese-trigger').getAttribute('aria-expanded')).toBe(
      'true',
    );
  });
  it('filters without accents, commits with Enter and restores the trigger focus', async () => {
    const f = await setup();
    const emit = vi.fn();
    f.componentInstance.selected.subscribe(emit);
    f.nativeElement.querySelector('#diocese-trigger').click();
    f.detectChanges();
    await f.whenStable();
    const input = f.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'grenoble';
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('[role=option]')).toHaveLength(1);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    f.detectChanges();
    expect(emit).toHaveBeenCalledWith(DIOCESES.find((d) => d.name === 'Grenoble-Vienne')!.id);
    expect(f.nativeElement.querySelector('input')).toBeNull();
  });
  it('does not replace the selected value on Escape or an empty search result', async () => {
    const id = DIOCESES[5].id;
    const f = await setup(id);
    const emit = vi.fn();
    f.componentInstance.selected.subscribe(emit);
    f.nativeElement.querySelector('#diocese-trigger').click();
    f.detectChanges();
    await f.whenStable();
    const input = f.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'zzzzunknown';
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Aucun résultat');
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    f.detectChanges();
    expect(emit).not.toHaveBeenCalled();
    expect(f.componentInstance.value()).toBe(id);
  });
  it('supports ArrowDown/End/Home and special choices without a second field', async () => {
    const f = await setup();
    const emit = vi.fn();
    f.componentInstance.selected.subscribe(emit);
    f.nativeElement
      .querySelector('#diocese-trigger')
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      );
    f.detectChanges();
    await f.whenStable();
    const input = f.nativeElement.querySelector('input');
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }),
    );
    f.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe(
      'diocese-option-' + (DIOCESES.length + 1),
    );
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }),
    );
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    f.detectChanges();
    expect(emit).toHaveBeenCalledWith('OTHER');
  });
  it('cannot open or emit in read-only dossiers', async () => {
    const f = await setup(DIOCESES[0].id);
    f.componentRef.setInput('disabled', true);
    f.detectChanges();
    const button = f.nativeElement.querySelector('button');
    expect(button.disabled).toBe(true);
    button.click();
    f.detectChanges();
    expect(f.nativeElement.querySelector('input')).toBeNull();
  });
});
