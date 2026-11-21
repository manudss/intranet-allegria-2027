import { FamilySignaturePanel, SignatureDraft } from './family-signature';
import { FamilyPdfPreview } from './family-pdf-preview';
import { NgTemplateOutlet } from '@angular/common';
import { familyRetryDelay, familyRateLimitMessage } from './family-rate-limit';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  inject,
  input,
  signal,
  computed,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { form } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import {
  EMPTY_HEALTH,
  HEALTH_FIELDS,
  HEALTH_SHEET_SECTIONS,
  HEALTH_VACCINES,
  HEALTH_CONTACT_COLUMNS,
  HEALTH_CONTACT_SLOTS,
  healthSheetItems,
  HEALTH_FORM_PAGES,
  HEALTH_MODEL_ITEMS,
  FOOD_ALLERGENS,
  FOOD_ALLERGEN_LABELS,
} from '@mej-allegria/shared';
import type { StructuredHealth, YouthIdentity, FamilyContact } from '@mej-allegria/shared';
@Component({
  selector: 'app-family-health',
  imports: [NgTemplateOutlet, FamilySignaturePanel, FamilyPdfPreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './family-health.html',
  styleUrl: './family-health.scss',
})
export class FamilyHealthPage implements OnInit, OnDestroy {
  readonly identity = input<YouthIdentity>();
  readonly contact = input<FamilyContact>();
  readonly youthId = input.required<string>();
  readonly readOnly = input(false);
  readonly previewSample = input<StructuredHealth>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef, { optional: true });
  private http = inject(HttpClient);
  protected previewMode = signal(false);
  protected pdfReady = signal(false);
  protected signingBusy = signal(false);
  protected plannedSignature = signal<SignatureDraft | undefined>(undefined);
  protected previewRequest = computed(() =>
    this.loaded() && !this.previewSample()
      ? {
          url: this.base() + '/preview',
          body: {
            health: {
              answers: this.model().answers,
              presence: this.data().presence || {},
              foodAllergens: this.data().foodAllergens,
              page: this.page(),
            },
            ...(this.plannedSignature() ? { signature: this.plannedSignature() } : {}),
          },
        }
      : null,
  );
  protected signatureKey = computed(() =>
    JSON.stringify([
      this.identity(),
      this.contact(),
      this.model().answers,
      this.data().presence || {},
      this.data().foodAllergens,
    ]),
  );
  protected prepareSignature = async () => {
    if (this.readOnly() || !this.loaded() || this.retryBlocked()) return null;
    if (!this.data().revision) this.dirty = true;
    if (!(await this.flush())) return null;
    return { revision: this.data().revision, version: this.declaration().version };
  };
  protected signatureCompleted(value: unknown) {
    this.data.set(value as StructuredHealth);
    this.status.set('Fiche signée avec confirmation par code. Téléchargez votre exemplaire.');
  }
  protected declaration = signal({ text: '', version: '' });
  protected sections = HEALTH_SHEET_SECTIONS;
  protected vaccines = HEALTH_VACCINES;
  protected contactColumns = HEALTH_CONTACT_COLUMNS;
  protected contactGroups = [
    { id: 'guardian', title: 'Représentants légaux et contacts du dossier' },
    { id: 'emergency', title: 'Autres personnes à contacter' },
  ];
  protected expanded = signal(new Set(['allergies']));
  protected loaded = signal(false);
  protected choiceOptions = [
    { value: '', label: 'Non renseigné' },
    { value: 'NO', label: 'Non' },
    { value: 'YES', label: 'Oui' },
  ];
  protected treatmentItem = HEALTH_MODEL_ITEMS[0];
  protected items = healthSheetItems;
  private addedContacts = signal<Record<string, number>>({});
  protected answer(key: string) {
    return (this.model().answers as Record<string, string>)[key] || '';
  }
  protected setAnswer(key: string, value: string) {
    if (this.readOnly() || !this.loaded()) return;
    this.model.update((m) => ({ ...m, answers: { ...m.answers, [key]: value } }));
    this.changed();
  }
  protected choiceValue(key: string) {
    return this.data().presence?.[key] || '';
  }
  protected hasVaccineRows() {
    return Object.entries(this.model().answers).some(([k, v]) => k.startsWith('vaccine_') && !!v);
  }
  protected genderLabel() {
    return (
      (
        {
          FEMALE: 'Féminin',
          MALE: 'Masculin',
          OTHER: 'Autre',
          UNDISCLOSED: 'Non précisé',
        } as Record<string, string>
      )[this.identity()?.sex || ''] || 'Non renseigné'
    );
  }
  protected capacityLabel() {
    return (
      (
        {
          SELF_ADULT: 'Adulte concerné',
          LEGAL: 'Représentant légal',
          GUARDIAN: 'Tutelle',
        } as Record<string, string>
      )[this.identity()?.legalCapacity || ''] ||
      this.identity()?.legalCapacity ||
      'Non renseignée'
    );
  }
  protected visibleContactSlots(group: string) {
    const slots = HEALTH_CONTACT_SLOTS.filter((s) => s.startsWith(group));
    const last = slots.reduce(
      (n, s, i) => (HEALTH_CONTACT_COLUMNS.some(([k]) => !!this.answer(s + '_' + k)) ? i + 1 : n),
      0,
    );
    return slots.slice(0, Math.max(last, this.addedContacts()[group] || 0));
  }
  protected addContact(group: string) {
    if (this.readOnly()) return;
    const count = this.visibleContactSlots(group).length;
    this.addedContacts.update((v) => ({ ...v, [group]: Math.min(count + 1, 2) }));
  }
  protected legacyFields(section: string) {
    const keys: Record<string, string[]> = {
      identity: ['guardian2', 'emergency2'],
      history: ['treatment', 'prescription'],
      allergies: ['foodAllergy', 'animalAllergy', 'pollenAllergy', 'drugAllergy', 'asthma'],
      vaccines: ['vaccinations'],
      adaptations: ['communication', 'sleep', 'mobility', 'sensory', 'learning', 'mental'],
      daily: ['swimming', 'equipment', 'dailyLife'],
      fears: ['fears'],
    };
    return HEALTH_FORM_PAGES.flatMap<readonly [string, string]>((p) => [...p.fields]).filter(
      (f) =>
        (keys[section] || []).includes(f[0]) &&
        !!this.answer(f[0]) &&
        !(section === 'history' && this.choiceValue('treatment') === 'YES'),
    );
  }
  protected toggled(id: string, event: Event) {
    const open = (event.target as HTMLDetailsElement).open;
    if (this.expanded().has(id) === open) return;
    this.expanded.update((s) => {
      const next = new Set(s);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  protected openSection(id: string) {
    this.expanded.update((s) => new Set([...s, id]));
    setTimeout(() => {
      const e = this.host?.nativeElement.querySelector<HTMLElement>('#health-section-' + id);
      e?.scrollIntoView?.({ block: 'start' });
      e?.querySelector('summary')?.focus();
    }, 0);
  }
  protected presence(key: string, value: string) {
    if (this.readOnly() || !this.loaded()) return;
    this.data.update((d) => {
      const presence = { ...d.presence };
      if (value) presence[key] = value as 'YES' | 'NO';
      else delete presence[key];
      return { ...d, presence };
    });
    this.changed();
  }
  protected allergens = FOOD_ALLERGENS;
  protected allergenLabels = FOOD_ALLERGEN_LABELS;
  protected data = signal<StructuredHealth>(structuredClone(EMPTY_HEALTH));
  protected page = signal(0);
  protected busy = signal(false);
  protected status = signal('');
  protected error = signal('');
  protected model = signal({
    answers: Object.fromEntries(HEALTH_FIELDS.map((key) => [key, ''])),
    signer: '',
    capacity: 'LEGAL',
    accepted: false,
  });
  protected healthForm = form(this.model);
  protected readonly retryBlocked = signal(false);
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;
  private generation = 0;
  private chain = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  protected base() {
    return '/api/public/family-space/youths/' + this.youthId() + '/health';
  }
  async ngOnInit() {
    const sample = this.previewSample();
    if (sample) {
      this.data.set(structuredClone(sample));
      this.page.set(sample.page);
      this.loaded.set(true);
      this.model.update((m) => ({ ...m, answers: { ...m.answers, ...sample.answers } }));
      this.declaration.set({
        version: 'EXEMPLE-FICTIF',
        text: 'Exemple fictif en lecture seule, sans attestation réelle.',
      });
      return;
    }
    try {
      this.declaration.set(
        await firstValueFrom(
          this.http.get<{ text: string; version: string }>(this.base() + '/declaration'),
        ),
      );
      const d = await firstValueFrom(this.http.get<StructuredHealth>(this.base()));
      this.data.set(d);
      this.page.set(d.page);
      this.loaded.set(true);
      this.model.update((m) => ({ ...m, answers: { ...m.answers, ...d.answers } }));
    } catch (e) {
      this.fail(e);
    }
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer);
  }
  hasUnsaved() {
    return this.dirty || this.busy() || this.signingBusy();
  }
  private fail(e: unknown) {
    const delay = familyRetryDelay(e);
    if (delay) {
      clearTimeout(this.timer);
      clearTimeout(this.retryTimer);
      this.retryBlocked.set(true);
      this.error.set(familyRateLimitMessage(delay));
      this.status.set('Non enregistré : saisie conservée dans cette page.');
      this.retryTimer = setTimeout(() => {
        this.retryBlocked.set(false);
        this.error.set('Le délai est écoulé. Réessayez la sauvegarde avant de quitter cette page.');
      }, delay);
      return;
    }
    this.error.set(
      e instanceof HttpErrorResponse && e.status < 500 && typeof e.error?.message === 'string'
        ? e.error.message
        : 'Sauvegarde santé impossible. Gardez cette page ouverte et réessayez.',
    );
  }
  protected changed() {
    if (this.readOnly()) return;
    this.model.update((m) => ({ ...m, accepted: false }));
    this.generation++;
    clearTimeout(this.timer);
    if (!this.retryBlocked()) this.timer = setTimeout(() => void this.save(), 1000);
    this.dirty = true;
    this.status.set('Modification en attente. Enregistrez avant de quitter la page santé.');
  }
  protected allergen(a: string, checked: boolean) {
    this.data.update((d) => ({
      ...d,
      foodAllergens: checked
        ? [...new Set([...d.foodAllergens, a])]
        : d.foodAllergens.filter((x) => x !== a),
    }));
    this.changed();
  }
  protected save() {
    if (this.readOnly() || this.retryBlocked()) return Promise.resolve();
    this.chain = this.chain.then(async () => {
      if (!this.dirty || this.retryBlocked()) return;
      this.busy.set(true);
      this.error.set('');
      const generation = this.generation;
      try {
        const d = this.data();
        const saved = await firstValueFrom(
          this.http.patch<StructuredHealth>(this.base(), {
            revision: d.revision,
            health: {
              answers: { ...this.model().answers },
              presence: { ...d.presence },
              foodAllergens: [...d.foodAllergens],
              page: this.page(),
            },
          }),
        );
        this.data.update((latest) => ({
          ...saved,
          presence: generation === this.generation ? saved.presence : latest.presence,
          foodAllergens:
            generation === this.generation ? saved.foodAllergens : latest.foodAllergens,
        }));
        this.dirty = generation !== this.generation;
        this.status.set(
          this.dirty
            ? 'Nouvelles modifications en attente.'
            : 'Informations santé enregistrées dans l’espace restreint.',
        );
        if (this.dirty) {
          clearTimeout(this.timer);
          this.timer = setTimeout(() => void this.save(), 100);
        }
      } catch (e) {
        this.fail(e);
      } finally {
        this.busy.set(false);
      }
    });
    return this.chain;
  }
  async flush() {
    clearTimeout(this.timer);
    await this.chain;
    if (this.dirty) await this.save();
    return !this.dirty;
  }
}
