import { FamilySignaturePanel } from './family-signature';
import { familyRetryDelay, familyRateLimitMessage } from './family-rate-limit';
import { DioceseSelect } from './diocese-select';
import { focusFamilyHeading } from './family-focus';

import { FamilyDocuments } from './family-documents';
import { FamilyHealthPage } from './family-health';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { form, FormField, required, pattern, maxLength } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';
import {
  DEFAULT_FAMILY_RULES,
  DIOCESES,
  EMPTY_CONTACT,
  FAMILY_PAGES,
  missingRequirements,
} from '@mej-allegria/shared';
import type { FamilyContact, FamilyRules, FamilySpace, YouthDossier } from '@mej-allegria/shared';
@Component({
  selector: 'app-family-space',
  imports: [
    FormField,
    RouterLink,
    FamilyHealthPage,
    FamilyDocuments,
    FamilySignaturePanel,
    DioceseSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './family-space.html',
  styleUrl: './family-space.scss',
})
export class FamilySpacePage implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef, { optional: true });
  protected readonly readOnly = computed(
    () => !!this.youth() && !['DRAFT', 'CORRECTION'].includes(this.youth()!.state),
  );
  protected readonly reviewContact = computed(() =>
    this.readOnly() && this.youth()?.contactAtSubmission
      ? this.youth()!.contactAtSubmission!
      : this.space()!.contact,
  );
  protected readonly canRetrySave = signal(false);
  protected readonly retryBlocked = signal(false);
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  protected dioceseLabel(id: string) {
    return (
      DIOCESES.find((d) => d.id === id)?.name ||
      (
        { UNKNOWN: 'Je ne sais pas', OTHER: 'Autre pays / autre juridiction' } as Record<
          string,
          string
        >
      )[id] ||
      'Non renseigné'
    );
  }
  protected capacityLabel(value: string) {
    return (
      (
        {
          LEGAL: 'Représentant légal',
          SELF_ADULT: 'Adulte concerné',
          DELEGATED: 'Responsable avec autorisation à vérifier',
        } as Record<string, string>
      )[value] || 'Non renseignée'
    );
  }
  protected requirementPage(label: string) {
    return label.startsWith('Signature')
      ? 4
      : label.startsWith('Présence')
        ? 2
        : /^(Responsable :|Contact d'urgence)/.test(label)
          ? 1
          : 0;
  }
  protected frenchDate(value: string) {
    const d = new Date(value);
    return Number.isNaN(d.valueOf())
      ? 'Non renseigné'
      : d.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  }
  private focusTitle() {
    setTimeout(() => {
      const heading = this.host?.nativeElement.querySelector<HTMLElement>('h1');
      focusFamilyHeading(heading);
    }, 0);
  }
  protected readonly space = signal<FamilySpace | null>(null);
  protected readonly rules = signal<FamilyRules>(DEFAULT_FAMILY_RULES);
  protected readonly selected = signal('');
  protected readonly youth = computed(
    () => this.space()?.youths.find((y) => y.id === this.selected()) || null,
  );
  protected readonly pages = FAMILY_PAGES;
  protected readonly page = signal(0);
  protected readonly error = signal('');
  protected readonly status = signal('');
  protected readonly busy = signal(false);
  protected readonly challengeId = signal('');
  protected readonly accessModel = signal({ email: '', code: '' });
  protected readonly accessForm = form(this.accessModel, (p) => {
    required(p.email);
    pattern(p.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    pattern(p.code, /^\d{8}$/);
    maxLength(p.code, 8);
  });
  protected readonly editModel = signal({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    sex: '',
    mejAgeGroup: '',
    dioceseId: '',
    otherDiocese: '',
    city: '',
    mejGroup: '',
    legalCapacity: '',
    presence: '',
    arrival: '',
    departure: '',
    transport: '',
    accommodation: '',
    notes: '',
  });
  protected readonly editForm = form(this.editModel);
  protected readonly contactModel = signal<FamilyContact>({ ...EMPTY_CONTACT });
  protected readonly contactForm = form(this.contactModel);
  protected readonly signatureModel = signal({
    name: '',
    capacity: 'LEGAL',
    accepted: false,
    finalAccepted: false,
  });
  protected readonly signatureForm = form(this.signatureModel);
  protected chooseDiocese(dioceseId: string) {
    if (this.readOnly()) return;
    this.editModel.update((m) => ({ ...m, dioceseId }));
    this.changed();
  }
  protected readonly missing = computed(() => {
    const y = this.youth(),
      s = this.space();
    return y && s ? missingRequirements(y, s.contact, this.rules()) : [];
  });
  protected readonly states: Record<string, string> = {
    DRAFT: 'À compléter',
    SUBMITTED: 'En vérification',
    CORRECTION: 'Correction demandée',
    VALIDATED: 'Dossier validé',
    CONFIRMED: 'Participation confirmée',
    REFUSED: 'Participation refusée',
    CANCELLED: 'Annulée',
  };
  protected readonly simulationLabels: Record<string, string> = {
    NOT_TESTED: 'Non testée',
    SUCCESS: 'Simulation réussie, aucun paiement effectué',
    FAILURE: 'Échec simulé',
    CANCELLED: 'Annulation simulée',
  };
  private healthEditor = viewChild(FamilyHealthPage);
  private documentEditor = viewChild(FamilyDocuments);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private chain = Promise.resolve();
  private dirty = false;
  private generation = 0;
  private readonly beforeUnload = (event: BeforeUnloadEvent) => {
    if (this.dirty || this.healthEditor()?.hasUnsaved() || this.documentEditor()?.isUploading()) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  async ngOnInit() {
    if (typeof window === 'undefined') return;
    // Public static site delegates the private portal to the API's same-origin host.
    if (!window.location.pathname.startsWith('/familles/')) {
      try {
        const response = await fetch(new URL('app-config.json', document.baseURI), {
          cache: 'no-store',
        });
        if (response.ok) {
          const config = await response.json();
          if (config.apiBaseUrl) {
            const target = new URL('/familles/espace-famille', config.apiBaseUrl);
            if (target.origin !== window.location.origin && target.protocol === 'https:') {
              window.location.replace(target.href);
              return;
            }
          }
        }
      } catch {
        /* Local same-origin builds need no external configuration. */
      }
    }
    window.addEventListener('beforeunload', this.beforeUnload);
    try {
      this.rules.set(
        await firstValueFrom(this.http.get<FamilyRules>('/api/public/family-space/rules')),
      );
      await this.reload();
    } catch (e) {
      if (!(e instanceof HttpErrorResponse) || e.status !== 401) this.fail(e);
    }
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
    clearTimeout(this.retryTimer);
    if (typeof window !== 'undefined')
      window.removeEventListener('beforeunload', this.beforeUnload);
  }
  private fail(e: unknown) {
    const delay = familyRetryDelay(e);
    if (delay) {
      clearTimeout(this.timer);
      clearTimeout(this.retryTimer);
      this.retryBlocked.set(true);
      this.error.set(familyRateLimitMessage(delay));
      this.status.set(
        this.dirty
          ? 'Non enregistré : saisie conservée dans cette page.'
          : 'Opération non terminée.',
      );
      this.canRetrySave.set(this.dirty);
      this.retryTimer = setTimeout(() => {
        this.retryBlocked.set(false);
        this.error.set(
          this.dirty
            ? 'Le délai est écoulé. Réessayez la sauvegarde avant de quitter cette page.'
            : 'Le délai est écoulé. Vous pouvez réessayer.',
        );
      }, delay);
      return;
    }
    this.error.set(
      e instanceof HttpErrorResponse
        ? e.status < 500 && typeof e.error?.message === 'string'
          ? e.error.message
          : 'Impossible de sauvegarder. Votre saisie reste visible. Réessayez avant de quitter.'
        : 'Une erreur est survenue. Réessayez.',
    );
    this.status.set(this.dirty ? 'Non enregistré' : 'Opération non terminée');
    this.canRetrySave.set(this.dirty);
  }
  protected async previewDemo() {
    await this.run(async () => {
      this.space.set(
        await firstValueFrom(
          this.http.post<FamilySpace>('/api/public/family-space/preview-demo', {}),
        ),
      );
      this.contactModel.set({ ...this.space()!.contact });
      this.focusTitle();
    });
  }
  protected async requestCode() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.accessModel().email)) {
      this.error.set('Indiquez une adresse e-mail valide.');
      return;
    }
    await this.run(async () => {
      const r = await firstValueFrom(
        this.http.post<{ challengeId: string }>('/api/public/family-space/access', {
          email: this.accessModel().email,
        }),
      );
      this.challengeId.set(r.challengeId);
      this.status.set('Code envoyé. Vérifiez aussi vos courriers indésirables.');
      setTimeout(
        () => this.host?.nativeElement.querySelector<HTMLElement>('#family-code')?.focus(),
        0,
      );
    });
  }
  protected async verify() {
    if (!/^\d{8}$/.test(this.accessModel().code)) {
      this.error.set('Le code doit contenir huit chiffres.');
      return;
    }
    await this.run(async () => {
      this.space.set(
        await firstValueFrom(
          this.http.post<FamilySpace>('/api/public/family-space/verify', {
            challengeId: this.challengeId(),
            code: this.accessModel().code,
          }),
        ),
      );
      this.contactModel.set({ ...this.space()!.contact });
      this.status.set('Votre espace est prêt.');
      this.focusTitle();
    });
  }
  protected async reload() {
    const s = await firstValueFrom(this.http.get<FamilySpace>('/api/public/family-space'));
    this.space.set(s);
    this.contactModel.set({ ...s.contact });
  }
  protected async logout() {
    if (!(await this.flush())) {
      this.error.set('Sauvegardez votre saisie avant de vous déconnecter.');
      return;
    }
    await this.run(async () => {
      await firstValueFrom(this.http.delete('/api/public/family-space/session'));
      this.space.set(null);
      this.selected.set('');
    });
  }
  protected async addYouth() {
    if (!(await this.flush())) return;
    await this.run(async () => {
      const s = this.space()!;
      const next = await firstValueFrom(
        this.http.post<FamilySpace>('/api/public/family-space/youths', { revision: s.revision }),
      );
      this.space.set(next);
      this.openYouth(next.youths[next.youths.length - 1]);
    });
  }
  protected openYouth(y: YouthDossier) {
    if (this.dirty) {
      this.error.set('Sauvegardez cette page avant de changer de dossier.');
      return;
    }
    this.contactModel.set({
      ...(!['DRAFT', 'CORRECTION'].includes(y.state) && y.contactAtSubmission
        ? y.contactAtSubmission
        : this.space()!.contact),
    });
    this.selected.set(y.id);
    this.page.set(y.currentPage);
    this.editModel.set({ ...y.identity, ...y.logistics });
    this.signatureModel.set({
      name: this.space()?.contact.name || '',
      capacity: y.identity.legalCapacity || 'LEGAL',
      accepted: false,
      finalAccepted: false,
    });
    this.error.set('');
    this.focusTitle();
  }
  protected async dashboard() {
    if (await this.flush()) {
      this.selected.set('');
      this.focusTitle();
    }
  }
  protected changed() {
    if (this.readOnly()) return;
    this.signatureModel.update((m) => ({ ...m, accepted: false, finalAccepted: false }));
    this.generation++;
    this.dirty = true;
    this.status.set('Modifications en attente de sauvegarde…');
    clearTimeout(this.timer);
    if (!this.retryBlocked())
      this.timer = setTimeout(() => {
        void this.save();
      }, 900);
  }
  protected contactChanged() {
    this.changed();
  }

  protected async flush() {
    if (this.documentEditor()?.isUploading()) {
      this.error.set('Attendez la fin du dépôt du fichier avant de changer de page.');
      return false;
    }
    const editor = this.healthEditor();
    if (editor && !(await editor.flush())) {
      this.error.set('Sauvegardez les informations santé avant de quitter cette page.');
      return false;
    }
    clearTimeout(this.timer);
    await this.chain;
    if (this.dirty) await this.save();
    return !this.dirty;
  }
  protected save() {
    if (this.readOnly() || this.retryBlocked()) return Promise.resolve();
    this.chain = this.chain.then(async () => {
      if (!this.dirty || !this.youth() || this.retryBlocked()) return;
      const s = this.space()!,
        y = this.youth()!,
        m = this.editModel(),
        generation = this.generation;
      this.busy.set(true);
      this.error.set('');
      try {
        let updated = s;
        if (this.page() === 1) {
          updated = await firstValueFrom(
            this.http.patch<FamilySpace>('/api/public/family-space/contact', {
              revision: s.revision,
              contact: this.contactModel(),
            }),
          );
        } else {
          updated = await firstValueFrom(
            this.http.patch<FamilySpace>('/api/public/family-space/youths/' + y.id, {
              revision: s.revision,
              patch: {
                identity: {
                  firstName: m.firstName,
                  lastName: m.lastName,
                  dateOfBirth: m.dateOfBirth,
                  sex: m.sex,
                  mejAgeGroup: m.mejAgeGroup,
                  dioceseId: m.dioceseId,
                  otherDiocese: m.otherDiocese,
                  city: m.city,
                  mejGroup: m.mejGroup,
                  legalCapacity: m.legalCapacity,
                },
                logistics: {
                  presence: m.presence,
                  arrival: m.arrival,
                  departure: m.departure,
                  transport: m.transport,
                  accommodation: m.accommodation,
                  notes: m.notes,
                },
                currentPage: this.page(),
              },
            }),
          );
        }
        this.space.set(updated);
        this.dirty = generation !== this.generation;
        if (this.dirty) {
          this.status.set('Nouvelles modifications en attente…');
          clearTimeout(this.timer);
          this.timer = setTimeout(() => void this.save(), 100);
          return;
        }
        this.canRetrySave.set(false);
        this.status.set('Enregistré dans votre espace. Vous pouvez revenir plus tard.');
      } catch (e) {
        this.fail(e);
      } finally {
        this.busy.set(false);
      }
    });
    return this.chain;
  }
  protected async go(page: number) {
    if (!(await this.flush())) return;
    this.page.set(page);
    this.focusTitle();
    if (!['DRAFT', 'CORRECTION'].includes(this.youth()!.state)) return;
    const s = this.space()!,
      y = this.youth()!;
    await this.run(async () => {
      this.space.set(
        await firstValueFrom(
          this.http.patch<FamilySpace>('/api/public/family-space/youths/' + y.id, {
            revision: s.revision,
            patch: { currentPage: page },
          }),
        ),
      );
    });
  }
  protected async simulate(simulation: string) {
    if (!(await this.flush())) return;
    await this.run(async () => {
      const s = this.space()!,
        y = this.youth()!;
      this.space.set(
        await firstValueFrom(
          this.http.patch<FamilySpace>('/api/public/family-space/youths/' + y.id, {
            revision: s.revision,
            patch: { simulation },
          }),
        ),
      );
      this.status.set(this.simulationLabels[simulation]);
    });
  }
  protected signaturePrepare(templateId: string, version: string) {
    // Cache this function by template below in the template via a stable memoized map.
    const key = templateId + ':' + version;
    if (!this.signaturePreparers.has(key))
      this.signaturePreparers.set(key, async () => {
        if (this.readOnly() || !(await this.flush())) return null;
        return { revision: this.space()!.revision, templateId, version };
      });
    return this.signaturePreparers.get(key)!;
  }
  private signaturePreparers = new Map<string, () => Promise<Record<string, unknown> | null>>();
  protected signatureKey(template: unknown) {
    return JSON.stringify([
      template,
      this.youth()?.identity,
      this.youth()?.logistics,
      this.space()?.contact,
    ]);
  }
  private signaturePreviews = new Map<string, { url: string; body: Record<string, unknown> }>();
  protected signaturePreview(templateId: string) {
    const key = this.youth()!.id + ':' + templateId;
    if (!this.signaturePreviews.has(key))
      this.signaturePreviews.set(key, {
        url:
          '/api/public/family-space/youths/' +
          this.youth()!.id +
          '/templates/' +
          templateId +
          '/preview',
        body: {},
      });
    return this.signaturePreviews.get(key)!;
  }
  protected signatureCompleted(value: unknown) {
    this.space.set(value as FamilySpace);
    this.signatureModel.update((m) => ({ ...m, accepted: false, finalAccepted: false }));
    this.status.set(
      'Signature confirmée pour ce jeune et cette version. Le PDF figé est conservé.',
    );
  }
  protected async submit() {
    if (!(await this.flush())) return;
    await this.run(async () => {
      const s = this.space()!,
        y = this.youth()!;
      this.space.set(
        await firstValueFrom(
          this.http.post<FamilySpace>('/api/public/family-space/youths/' + y.id + '/submit', {
            revision: s.revision,
            accepted: this.signatureModel().finalAccepted,
          }),
        ),
      );
      this.status.set(
        'Dossier envoyé pour vérification. La participation n’est pas encore confirmée.',
      );
    });
  }
  private async run(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy.set(false);
    }
  }
}
