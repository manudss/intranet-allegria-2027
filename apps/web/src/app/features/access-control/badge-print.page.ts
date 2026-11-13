import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CdkDrag, CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { SelectFieldComponent, SelectOption } from '../../shared/select-field.component';
import { JeunesRepartitionFilters } from '../../models/models';
import {
  AccessControlApiService,
  AccessBadge,
  AccessBadgeStatus,
} from './access-control-api.service';
import {
  BadgePrintApi,
  PoolPerson,
  PrintPreparation,
  VolunteerPrintFilters,
} from './badge-print-api.service';
import {
  PrintCard,
  badgeLabel,
  printableName,
  randomBadgeCodes,
  qrSvg,
  svgData,
  printDocument,
} from './badge-print.logic';

@Component({
  selector: 'app-badge-print',
  standalone: true,
  imports: [...SHARED_IMPORTS, SelectFieldComponent, RouterLink, CdkDrag, CdkDropList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './badge-print.page.html',
  styleUrls: ['../jeunes-repartition/jeunes-repartition.scss', './badge-print.page.scss'],
})
export class BadgePrintPage implements OnInit, OnDestroy {
  private readonly api = inject(BadgePrintApi);
  private readonly stockApi = inject(AccessControlApiService);
  readonly mode = signal<'people' | 'stock'>('people');
  readonly kind = signal<'participant' | 'volunteer'>('participant');
  readonly step = signal<1 | 2>(1);
  readonly youthFilters = signal<JeunesRepartitionFilters | null>(null);
  readonly volFilters = signal<VolunteerPrintFilters | null>(null);
  readonly results = signal<PoolPerson[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly pool = signal<PoolPerson[]>([]);
  readonly recap = signal<PrintPreparation | null>(null);
  readonly cards = signal<PrintCard[]>([]);
  readonly images = signal<string[]>([]);
  readonly mono = signal(false);
  readonly stocks = signal<AccessBadge[]>([]);
  readonly stockTotal = signal(0);
  readonly stockOffset = signal(0);
  readonly stockSelected = signal<AccessBadge[]>([]);
  readonly prepared = signal(false);
  search = '';
  type = 'all';
  ageGroup = '';
  sex = '';
  groupId = 0;
  city = '';
  diocese = '';
  assignment = 'all';
  poleId = 0;
  skill = '';
  tag = '';
  lot = '';
  quantity = 12;
  status: AccessBadgeStatus | '' = 'AVAILABLE';
  stockLot = '';
  codeSearch = '';
  private epoch = 0;
  private stockEpoch = 0;
  private alive = true;
  private pendingCodes: string[] = [];
  private pendingLot = '';
  private logoData = '';
  readonly label = badgeLabel;
  readonly name = printableName;
  readonly assignmentOptions: SelectOption<string>[] = [
    { value: 'all', label: 'Toutes' },
    { value: 'unassigned', label: 'Sans équipe' },
    { value: 'assigned', label: 'Avec équipe' },
  ];
  readonly typeOptions: SelectOption<string>[] = [
    { value: 'all', label: 'Jeunes + animateurs' },
    { value: 'JEUNE', label: 'Jeunes' },
    { value: 'ANIMATEUR', label: 'Animateurs' },
  ];
  readonly sexOptions: SelectOption<string>[] = [
    { value: '', label: 'Tous' },
    { value: 'FEMALE', label: 'Filles' },
    { value: 'MALE', label: 'Garçons' },
  ];
  readonly ageOptions = computed(() =>
    this.options(this.youthFilters()?.ageGroups ?? [], 'Toutes'),
  );
  readonly groupOptions = computed(() => [
    { value: 0, label: 'Tous' },
    ...(this.youthFilters()?.groups ?? []).map((g) => ({ value: g.id, label: g.name })),
  ]);
  readonly cityOptions = computed(() => this.options(this.youthFilters()?.cities ?? [], 'Toutes'));
  readonly dioceseOptions = computed(() =>
    this.options(this.youthFilters()?.dioceses ?? [], 'Tous'),
  );
  readonly poleOptions = computed(() => [
    { value: 0, label: 'Tous' },
    ...(this.volFilters()?.poles ?? []).map((g) => ({ value: g.id, label: g.name })),
  ]);
  readonly skillOptions = computed(() => this.options(this.volFilters()?.skills ?? [], 'Toutes'));
  readonly tagOptions = computed(() => this.options(this.volFilters()?.tags ?? [], 'Toutes'));
  readonly counts = computed(() => ({
    young: this.pool().filter((p) => p.type === 'JEUNE').length,
    anim: this.pool().filter((p) => p.type === 'ANIMATEUR').length,
    vol: this.pool().filter((p) => p.type === 'BENEVOLE').length,
  }));
  readonly pages = computed(() => Math.ceil(this.cards().length / 12));
  private options(values: string[], all: string): SelectOption<string>[] {
    return [{ value: '', label: all }, ...values.map((value) => ({ value, label: value }))];
  }
  ngOnInit() {
    this.api.youthFilters().subscribe({
      next: (r) => this.youthFilters.set(r),
      error: () =>
        this.error.set('Filtres jeunes indisponibles. Réessayez en rechargeant la page.'),
    });
    this.api.volunteerFilters().subscribe({
      next: (r) => this.volFilters.set(r),
      error: () =>
        this.error.set('Filtres bénévoles indisponibles. Réessayez en rechargeant la page.'),
    });
    void this.find();
  }
  ngOnDestroy() {
    this.alive = false;
    this.epoch++;
    this.stockEpoch++;
  }
  setMode(mode: 'people' | 'stock') {
    if (this.busy()) return;
    this.mode.set(mode);
    this.step.set(1);
    this.clearPrepared();
    if (mode === 'stock') void this.findStock();
  }
  setKind(kind: 'participant' | 'volunteer') {
    this.kind.set(kind);
    this.search = '';
    void this.find();
  }
  private filters() {
    return {
      search: this.search,
      assignment: this.assignment,
      limit: 100,
      ...(this.kind() === 'participant'
        ? {
            type: this.type,
            ageGroup: this.ageGroup,
            sex: this.sex,
            groupId: this.groupId || undefined,
            city: this.city,
            diocese: this.diocese,
          }
        : { poleId: this.poleId || undefined, skill: this.skill, tag: this.tag }),
    };
  }
  async find(append = false) {
    const epoch = ++this.epoch;
    const kind = this.kind(),
      offset = append ? this.results().length : 0;
    this.loading.set(true);
    if (!append) this.results.set([]);
    try {
      const r = await this.api.people(kind, { ...this.filters(), offset });
      if (this.alive && epoch === this.epoch) {
        this.results.update((old) => (append ? [...old, ...r.items] : r.items));
        this.total.set(r.total);
      }
    } catch {
      if (epoch === this.epoch) {
        this.results.set([]);
        this.total.set(0);
        this.error.set('Recherche impossible. Aucun résultat périmé affiché.');
      }
    } finally {
      if (epoch === this.epoch) this.loading.set(false);
    }
  }
  has(p: PoolPerson) {
    return this.pool().some((x) => x.key === p.key);
  }
  add(p: PoolPerson) {
    if (this.busy() || this.has(p)) return;
    if (this.pool().length >= 100) {
      this.error.set(
        'Maximum 100 personnes par planche de génération. Imprimez ce pool avant de continuer.',
      );
      return;
    }
    this.clearPrepared();
    this.pool.update((old) => [...old, p]);
  }
  remove(p: PoolPerson) {
    if (this.busy()) return;
    this.clearPrepared();
    this.pool.update((old) => old.filter((x) => x.key !== p.key));
  }
  clearPool() {
    if (this.busy()) return;
    this.pool.set([]);
    this.clearPrepared();
  }
  drop(event: CdkDragDrop<unknown>) {
    const p = event.item.data as PoolPerson;
    if (event.container.id === 'badge-pool') this.add(p);
    else if (event.previousContainer.id === 'badge-pool') this.remove(p);
  }
  async addAll() {
    if (this.busy() || this.loading()) return;
    const kind = this.kind(),
      filters = this.filters(),
      epoch = this.epoch;
    this.busy.set(true);
    this.error.set('');
    try {
      const collected: PoolPerson[] = [];
      let offset = 0,
        total = 1;
      do {
        const r = await this.api.people(kind, { ...filters, offset });
        total = r.total;
        collected.push(...r.items);
        if (!r.items.length && offset < total) throw new Error('Pagination interrompue');
        offset += r.items.length;
        if (this.pool().length + collected.filter((p) => !this.has(p)).length > 100)
          throw new Error(
            'Plus de 100 personnes : affinez la recherche ou ajoutez-les une par une. Aucun ajout partiel effectué.',
          );
      } while (offset < total);
      if (epoch !== this.epoch) throw new Error('La recherche a changé. Recommencez.');
      this.clearPrepared();
      this.pool.update((old) => [
        ...old,
        ...collected.filter((p) => !old.some((x) => x.key === p.key)),
      ]);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Ajout impossible');
    } finally {
      this.busy.set(false);
    }
  }
  private clearPrepared() {
    this.cards.set([]);
    this.images.set([]);
    this.recap.set(null);
    this.prepared.set(false);
    this.notice.set('');
  }
  async review() {
    if (this.busy() || !this.pool().length) return;
    this.busy.set(true);
    this.error.set('');
    this.clearPrepared();
    try {
      this.recap.set(await firstValueFrom(this.api.preview(this.pool())));
      this.step.set(2);
    } catch {
      this.error.set('Récapitulatif indisponible. Aucun badge créé.');
    } finally {
      this.busy.set(false);
    }
  }
  async generate() {
    if (this.busy() || !this.recap() || this.prepared()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(this.api.prepare(this.pool()));
      this.recap.set(r);
      this.cards.set(r.items);
      this.prepared.set(true);
      this.notice.set(
        `${r.reused} badge(s) réutilisé(s), ${r.created} nouveau(x). Aucun badge actif remplacé.`,
      );
      await this.renderCodes();
    } catch {
      this.error.set(
        this.prepared()
          ? 'Badges prêts, mais images indisponibles. Réessayez de préparer les images.'
          : 'Génération non confirmée. Réessayez : un badge déjà créé sera réutilisé.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  async findStock(append = false) {
    const epoch = ++this.stockEpoch,
      offset = append ? this.stocks().length : 0;
    this.loading.set(true);
    try {
      const r = await firstValueFrom(
        this.stockApi.listBadges({
          status: this.status || undefined,
          lot: this.stockLot || undefined,
          q: this.codeSearch || undefined,
          limit: 100,
          offset,
        }),
      );
      if (epoch === this.stockEpoch && this.alive) {
        this.stocks.update((old) => (append ? [...old, ...r.items] : r.items));
        this.stockTotal.set(r.total);
      }
    } catch {
      if (epoch === this.stockEpoch) {
        this.stocks.set([]);
        this.error.set('Chargement du stock impossible.');
      }
    } finally {
      if (epoch === this.stockEpoch) this.loading.set(false);
    }
  }
  selected(b: AccessBadge) {
    return this.stockSelected().some((p) => p.id === b.id);
  }
  toggleStock(b: AccessBadge) {
    if (this.busy() || b.status === 'LOST' || b.status === 'REVOKED') return;
    if (this.selected(b)) this.stockSelected.update((old) => old.filter((x) => x.id !== b.id));
    else if (this.stockSelected().length < 100) this.stockSelected.update((old) => [...old, b]);
    else this.error.set('Maximum 100 badges par impression.');
    this.clearPrepared();
  }
  async createStock() {
    if (this.busy()) return;
    this.error.set('');
    this.busy.set(true);
    try {
      if (!this.pendingCodes.length) {
        this.pendingCodes = randomBadgeCodes(this.quantity);
        this.pendingLot = this.lot.trim();
        if (!this.pendingLot || this.pendingLot.length > 120) {
          this.pendingCodes = [];
          throw new Error('Renseignez un lot (120 caractères maximum).');
        }
      }
      const codes = [...this.pendingCodes],
        lot = this.pendingLot;
      await firstValueFrom(this.stockApi.registerStock(lot, codes));
      this.pendingCodes = [];
      this.pendingLot = '';
      this.stockLot = lot;
      this.status = 'AVAILABLE';
      await this.findStock();
      this.notice.set(
        `${codes.length} codes enregistrés dans ${lot}. Sélectionnez les badges à imprimer.`,
      );
    } catch (e) {
      this.error.set(
        this.pendingCodes.length
          ? 'Enregistrement non confirmé. Réessayez avec les mêmes codes conservés, sans nouveau lot.'
          : e instanceof Error
            ? e.message
            : 'Enregistrement impossible.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  pendingStock() {
    return this.pendingCodes.length > 0;
  }
  async reviewStock() {
    if (this.busy() || !this.stockSelected().length) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const checked: AccessBadge[] = [];
      for (const badge of this.stockSelected()) {
        const r = await firstValueFrom(this.stockApi.listBadges({ q: badge.code, limit: 100 }));
        const current = r.items.find((b) => b.id === badge.id && b.code === badge.code);
        if (!current || current.status === 'LOST' || current.status === 'REVOKED')
          throw new Error(
            'Un badge sélectionné est perdu, révoqué ou introuvable. Retirez-le avant impression.',
          );
        checked.push(current);
      }
      this.cards.set(
        checked.map((p) => ({
          id: p.id,
          firstName: 'Badge',
          lastName: null,
          type: '',
          badgeId: p.id,
          code: p.code,
        })),
      );
      this.prepared.set(true);
      await this.renderCodes();
      this.step.set(2);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Préparation impossible');
    } finally {
      this.busy.set(false);
    }
  }
  private async loadLogo() {
    if (this.logoData) return;
    const response = await fetch('/genfavicon-256.png');
    if (!response.ok) throw new Error('Favicon absent');
    const blob = await response.blob();
    this.logoData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  async renderCodes() {
    this.images.set([]);
    if (!this.mono()) await this.loadLogo();
    this.images.set(
      this.cards().map((p) => svgData(qrSvg(p.code ?? '', this.logoData, this.mono()))),
    );
  }
  async retryImages() {
    try {
      await this.renderCodes();
    } catch {
      this.error.set('Images indisponibles. Essayez le mode noir et blanc.');
    }
  }
  async setMono(value: boolean) {
    this.mono.set(value);
    try {
      await this.renderCodes();
    } catch {
      this.error.set('Images indisponibles. Essayez le mode noir et blanc.');
    }
  }
  async print() {
    if (
      this.busy() ||
      !this.prepared() ||
      this.images().length !== this.cards().length ||
      !this.cards().length
    )
      return;
    this.busy.set(true);
    this.error.set('');
    let frame: HTMLIFrameElement | undefined;
    try {
      if (this.mode() === 'people') {
        const current = await firstValueFrom(this.api.preview(this.pool()));
        if (
          current.items.length !== this.cards().length ||
          this.cards().some((p) => !current.items.some((c) => c.id === p.id && c.code === p.code))
        )
          throw new Error(
            'Un badge a changé depuis la génération. Revenez à la sélection et préparez de nouveau la planche.',
          );
      } else {
        for (const p of this.cards()) {
          const current = await firstValueFrom(
            this.stockApi.listBadges({ q: p.code ?? '', limit: 100 }),
          );
          if (
            !current.items.some(
              (b) =>
                b.id === p.id && b.code === p.code && b.status !== 'LOST' && b.status !== 'REVOKED',
            )
          )
            throw new Error(
              'Un badge est perdu, révoqué ou introuvable. Préparez de nouveau la sélection.',
            );
        }
      }
      frame = document.createElement('iframe');
      frame.style.position = 'fixed';
      frame.style.width = '0';
      frame.style.height = '0';
      frame.style.border = '0';
      frame.title = 'Planche de badges à imprimer';
      document.body.append(frame);
      const doc = frame.contentDocument;
      if (!doc) throw new Error('Fenêtre inaccessible');
      doc.open();
      doc.write(printDocument(this.cards(), this.images(), location.origin));
      doc.close();
      await Promise.all(Array.from(doc.images).map((img) => img.decode()));
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      this.notice.set(
        'Impression ouverte. A4, taille 100 %, sans en-tête/pied de page ; activez les arrière-plans pour les bandeaux. Vérifiez un badge sur papier avec un téléphone.',
      );
      const cleanup = frame;
      setTimeout(() => cleanup.remove(), 120000);
    } catch (e) {
      frame?.remove();
      this.error.set(
        e instanceof Error
          ? e.message
          : 'Impression impossible : une image est absente ou la fenêtre est bloquée. Aucun nouveau badge créé.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
