import { TestBed } from '@angular/core/testing';
import { FamilyAttestation } from './family-attestation';
describe('Per-document explicit consent', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('never shares consent between two document controls and resets after an attempt', async () => {
    TestBed.configureTestingModule({ imports: [FamilyAttestation] });
    const a = TestBed.createComponent(FamilyAttestation);
    a.componentRef.setInput('documentId', 'one');
    a.componentRef.setInput('signer', 'Parent FICTIF');
    const b = TestBed.createComponent(FamilyAttestation);
    b.componentRef.setInput('documentId', 'two');
    for (const [f, id] of [
      [a, 'one'],
      [b, 'two'],
    ] as const) {
      f.componentRef.setInput('documentId', id);
      f.componentRef.setInput('signer', 'Parent FICTIF');
      f.detectChanges();
    }
    const emit = vi.fn();
    a.componentInstance.accepted.subscribe(emit);
    const checkbox = a.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('input', { bubbles: true }));
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    a.detectChanges();
    await a.whenStable();
    expect(
      (b.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement).checked,
    ).toBe(false);
    a.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    a.detectChanges();
    await a.whenStable();
    expect(emit).toHaveBeenCalledWith({ name: 'Parent FICTIF', capacity: 'LEGAL', accepted: true });
    expect(checkbox.checked).toBe(false);
  });
});
