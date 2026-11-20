import { FamilyDocuments } from './family-documents';
import { FamilyHealthPage } from './family-health';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { form, FormField } from '@angular/forms/signals';
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
  imports: [FormField, RouterLink, FamilyHealthPage, FamilyDocuments],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './family-space.html',
  styleUrl: './family-space.scss',
})
export class FamilySpacePage implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
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
  protected readonly accessForm = form(this.accessModel);
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
  protected readonly dioceseSearch = signal('');
  protected readonly dioceses = computed(() => {
    const q = this.dioceseSearch()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return DIOCESES.filter((d) =>
      d.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(q),
    );
  });
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
  private timer: ReturnType<typeof setTimeout> | undefined;
  private chain = Promise.resolve();
  private dirty = false;
  private generation = 0;
  private readonly beforeUnload = (event: BeforeUnloadEvent) => {
    if (this.dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  };
  async ngOnInit() {
    if (typeof window === 'undefined') return;
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
    if (typeof window !== 'undefined')
      window.removeEventListener('beforeunload', this.beforeUnload);
  }
  private fail(e: unknown) {
    this.error.set(
      e instanceof HttpErrorResponse
        ? typeof e.error?.message === 'string'
          ? e.error.message
          : 'Impossible de sauvegarder. Votre saisie reste visible. Réessayez avant de quitter.'
        : 'Une erreur est survenue. Réessayez.',
    );
    this.status.set('Non enregistré');
  }
  protected async requestCode() {
    await this.run(async () => {
      const r = await firstValueFrom(
        this.http.post<{ challengeId: string }>('/api/public/family-space/access', {
          email: this.accessModel().email,
        }),
      );
      this.challengeId.set(r.challengeId);
      this.status.set('Code envoyé. Vérifiez aussi vos courriers indésirables.');
    });
  }
  protected async verify() {
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
    });
  }
  protected async reload() {
    const s = await firstValueFrom(this.http.get<FamilySpace>('/api/public/family-space'));
    this.space.set(s);
    this.contactModel.set({ ...s.contact });
  }
  protected async logout() {
    if (this.dirty) {
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
  }
  protected async dashboard() {
    if (await this.flush()) this.selected.set('');
  }
  protected changed() {
    this.generation++;
    this.dirty = true;
    this.status.set('Modifications en attente de sauvegarde…');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.save();
    }, 900);
  }
  protected contactChanged() {
    this.changed();
  }

  protected async flush() {
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
    this.chain = this.chain.then(async () => {
      if (!this.dirty || !this.youth()) return;
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
  protected async sign(templateId: string, version: string) {
    if (!(await this.flush())) return;
    const m = this.signatureModel();
    await this.run(async () => {
      const s = this.space()!,
        y = this.youth()!;
      this.space.set(
        await firstValueFrom(
          this.http.post<FamilySpace>('/api/public/family-space/youths/' + y.id + '/signatures', {
            revision: s.revision,
            templateId,
            version,
            signerName: m.name,
            capacity: m.capacity,
            accepted: m.accepted,
          }),
        ),
      );
      this.status.set('Attestation enregistrée pour ce jeune et cette version du document.');
    });
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
