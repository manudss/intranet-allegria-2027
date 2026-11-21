import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FamilyHealthPage } from './family-health';
import {
  EMPTY_HEALTH,
  HEALTH_FIELDS,
  HEALTH_EXTRA_FIELDS,
  healthSheetItems,
} from '@mej-allegria/shared';

async function setup(readOnly = false) {
  TestBed.configureTestingModule({
    imports: [FamilyHealthPage],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(FamilyHealthPage);
  fixture.componentRef.setInput('youthId', 'test');
  fixture.componentRef.setInput('readOnly', readOnly);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http
    .expectOne((r) => r.url.endsWith('/declaration'))
    .flush({ version: 'demo-fiction-1', text: 'FICTIF' });
  await Promise.resolve();
  http
    .expectOne((r) => r.url.endsWith('/health'))
    .flush({
      ...EMPTY_HEALTH,
      answers: {
        foodAllergy: 'Ancien texte FICTIF intégral',
        communication: 'Ancienne réponse groupée FICTIVE',
        detail_foodAllergy: 'Détail FICTIF',
      },
      presence: { foodAllergy: 'YES' },
    });
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, http, el: fixture.nativeElement as HTMLElement };
}
function choose(el: HTMLElement, id: string, label: string) {
  const group = el.querySelector<HTMLElement>(`[aria-label="${id}"]`)!;
  const b = Array.from(group.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === label,
  )!;
  b.click();
}
describe('Editable health sheet', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('keeps every optional source row addressable with unique allowlisted fields', () => {
    expect(new Set(HEALTH_FIELDS).size).toBe(HEALTH_FIELDS.length);
    for (const section of ['allergies', 'adaptations', 'daily', 'fears'])
      for (const item of healthSheetItems(section))
        expect(HEALTH_FIELDS).toContain('detail_' + item.id);
    expect(healthSheetItems('adaptations')).toHaveLength(17);
    expect(healthSheetItems('daily')).toHaveLength(9);
    expect(HEALTH_EXTRA_FIELDS.filter(([k]) => k.startsWith('vaccine_'))).toHaveLength(18);
  });
  it('keeps legacy text and hidden details, never derives No, and saves both formats', async () => {
    const { fixture, http, el } = await setup();
    const old = el.querySelector<HTMLTextAreaElement>('#health-foodAllergy')!;
    expect(old.value).toBe('Ancien texte FICTIF intégral');
    choose(el, 'Allergies alimentaires', 'Non');
    fixture.detectChanges();
    const detail = el.querySelector<HTMLTextAreaElement>('#health-detail_foodAllergy')!;
    expect(detail.value).toBe('Détail FICTIF');
    choose(el, 'Allergies alimentaires', 'Non renseigné');
    fixture.detectChanges();
    const save = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Enregistrer la fiche santé',
    )!;
    save.click();
    await Promise.resolve();
    const req = http.expectOne((r) => r.method === 'PATCH');
    expect(req.request.body.health.presence.foodAllergy).toBeUndefined();
    expect(req.request.body.health.answers.foodAllergy).toBe('Ancien texte FICTIF intégral');
    expect(req.request.body.health.answers.detail_foodAllergy).toBe('Détail FICTIF');
    expect(req.request.body.health.answers.communication).toBe('Ancienne réponse groupée FICTIVE');
    req.flush({ ...req.request.body.health, revision: 1, signature: null });
    await fixture.whenStable();
    http.verify();
    fixture.destroy();
  });
  it('opens sections by keyboard-compatible buttons and preserves nonmedical absence as empty', async () => {
    const { fixture, http, el } = await setup();
    const nav = el.querySelector('nav')!;
    Array.from(nav.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Vaccinations'))!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector<HTMLDetailsElement>('#health-section-vaccines')!.open).toBe(true);
    expect(el.querySelector<HTMLInputElement>('#health-vaccine_0_date')!.value).toBe('');
    expect(
      el
        .querySelector('[aria-label="Allergies aux animaux"] button[aria-pressed="true"]')
        ?.textContent?.trim(),
    ).toBe('Non renseigné');
    http.verify();
    fixture.destroy();
  });
  it('disables medical edits and saves in read-only mode', async () => {
    const { fixture, http, el } = await setup(true);
    expect(el.querySelector<HTMLInputElement>('#health-birthPlace')!.matches(':disabled')).toBe(
      true,
    );
    expect(
      el
        .querySelector<HTMLButtonElement>('[aria-label="Allergies alimentaires"] button')!
        .matches(':disabled'),
    ).toBe(true);
    expect(
      Array.from(el.querySelectorAll('button')).some(
        (b) => b.textContent?.trim() === 'Enregistrer la fiche santé',
      ),
    ).toBe(false);
    http.expectNone((r) => r.method === 'PATCH');
    http.verify();
    fixture.destroy();
  });
});
