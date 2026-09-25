import { TestBed } from '@angular/core/testing';
import { Accordion } from './accordion';
import { FaqItem } from '../../../core/models/content.models';

describe('Accordion', () => {
  const items: FaqItem[] = [
    { id: 'q1', question: 'Question un ?', answer: 'Réponse un.' },
    { id: 'q2', question: 'Question deux ?', answer: 'Réponse deux.' },
  ];

  async function createFixture() {
    await TestBed.configureTestingModule({ imports: [Accordion] }).compileComponents();
    const fixture = TestBed.createComponent(Accordion);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('idPrefix', 'test');
    fixture.detectChanges();
    return fixture;
  }

  it('renders one trigger button per item, collapsed by default', async () => {
    const fixture = await createFixture();
    const triggers = fixture.nativeElement.querySelectorAll('.accordion__trigger');
    expect(triggers.length).toBe(2);
    triggers.forEach((trigger: HTMLButtonElement) => {
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('toggles aria-expanded and reveals the panel on click', async () => {
    const fixture = await createFixture();
    const trigger = fixture.nativeElement.querySelector('.accordion__trigger') as HTMLButtonElement;

    trigger.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const panel = fixture.nativeElement.querySelector('#test-panel-q1') as HTMLElement;
    expect(panel.hidden).toBe(false);

    trigger.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the item matching initialOpenId (deep-link via URL fragment)', async () => {
    await TestBed.configureTestingModule({ imports: [Accordion] }).compileComponents();
    const fixture = TestBed.createComponent(Accordion);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('idPrefix', 'test');
    fixture.componentRef.setInput('initialOpenId', 'test-q2');
    fixture.detectChanges();

    const triggers = fixture.nativeElement.querySelectorAll('.accordion__trigger');
    expect(triggers[0].getAttribute('aria-expanded')).toBe('false');
    expect(triggers[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('associates each trigger with its panel via aria-controls', async () => {
    const fixture = await createFixture();
    const trigger = fixture.nativeElement.querySelector('.accordion__trigger') as HTMLButtonElement;
    const controlledId = trigger.getAttribute('aria-controls');
    expect(fixture.nativeElement.querySelector(`#${controlledId}`)).toBeTruthy();
  });
});
