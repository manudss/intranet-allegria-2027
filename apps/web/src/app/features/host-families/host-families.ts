import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, min, required, submit } from '@angular/forms/signals';
import { finalize } from 'rxjs';
import { HostFamily, HostFamilyPayload } from '../../models/models';
import { HostFamiliesApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { DataTableColumn } from '../../shared/data-table';
const blank = (): HostFamilyPayload => ({
  familyName: '',
  address: '',
  postalCode: '',
  city: '',
  phone: '',
  email: '',
  maxCapacity: 1,
  maxUnder18: 0,
  parish: '',
  notes: '',
  latitude: null,
  longitude: null,
  maxAnimators: null,
  constraints: null,
  tags: null,
  status: 'DRAFT',
});
@Component({
  selector: 'app-host-families',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  template: `<app-page-layout title="Familles d'accueil" description="Capacités et coordonnées"
      ><button actions tuiButton (click)="create()">Nouvelle famille</button>
      <tui-textfield iconStart="@tui.search">
        <label for="rechercher-une-famille" tuiLabel>Rechercher une famille</label><input tuiInput placeholder="Nom ou ville…" [value]="query()" (input)="query.set($any($event.target).value)" id="rechercher-une-famille" />
      </tui-textfield>
      @if (loading()) {
        <tui-loader />
      } @else {
        <app-data-table [rows]="filtered()" [columns]="tableColumns" (rowSelected)="open($event)" />
      }
    </app-page-layout>
    @if (opened()) {
      <tui-drawer direction="end"
        ><header>
          <h2>{{ mode() === 'create' ? 'Nouvelle famille' : selected()?.familyName }}</h2>
        </header>
        @if (mode() === 'detail') {
          <dl>
            <dt>Adresse</dt>
            <dd>{{ selected()?.address }}, {{ selected()?.postalCode }} {{ selected()?.city }}</dd>
            <dt>Capacité</dt>
            <dd>{{ selected()?.maxCapacity }} dont {{ selected()?.maxUnder18 }} mineurs</dd>
            <dt>Contact</dt>
            <dd>{{ selected()?.email || selected()?.phone || '—' }}</dd>
            <dt>Paroisse</dt>
            <dd>{{ selected()?.parish || '—' }}</dd>
            <dt>Notes</dt>
            <dd>{{ selected()?.notes || '—' }}</dd>
          </dl>
         } @else {
           <form class="drawer-form">
             <tui-textfield iconStart="@tui.home">
               <label for="nom-de-la-famille" tuiLabel>Nom de la famille</label><input tuiInput [formField]="familyForm.familyName" id="nom-de-la-famille" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.map-pin" class="wide">
               <label for="adresse-2" tuiLabel>Adresse</label><input tuiInput [formField]="familyForm.address" id="adresse-2" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.map">
               <label for="code-postal" tuiLabel>Code postal</label><input tuiInput [formField]="familyForm.postalCode" id="code-postal" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.map-pin">
               <label for="ville-2" tuiLabel>Ville</label><input tuiInput [formField]="familyForm.city" id="ville-2" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.mail">
               <label for="email-2" tuiLabel>Email</label><input tuiInput type="email" [formField]="familyForm.email" id="email-2" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.phone">
               <label for="telephone-2" tuiLabel>Téléphone</label><input tuiInput [formField]="familyForm.phone" id="telephone-2" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.users">
               <label for="capacite-totale" tuiLabel>Capacité totale</label><input tuiInput type="number" [formField]="familyForm.maxCapacity" id="capacite-totale" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.baby">
               <label for="capacite-mineurs" tuiLabel>Capacité mineurs</label><input tuiInput type="number" [formField]="familyForm.maxUnder18" id="capacite-mineurs" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.church">
               <label for="paroisse-2" tuiLabel>Paroisse</label><input tuiInput [formField]="familyForm.parish" id="paroisse-2" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.file-text" class="wide">
               <label for="notes-2" tuiLabel>Notes</label><textarea tuiTextarea [formField]="$any(familyForm.notes)" id="notes-2"></textarea>
             </tui-textfield>
           </form>
         }
        <footer>
          <button tuiButton appearance="flat" (click)="opened.set(false)">Fermer</button>
          @if (mode() === 'detail') {
            <button tuiButton (click)="edit()">Modifier</button
            ><button tuiButton appearance="secondary-destructive" (click)="remove()">
              Supprimer
            </button>
          } @else {
            <button tuiButton (click)="save()">Enregistrer</button>
          }
        </footer></tui-drawer
      >
    }`,
  styleUrl: '../../shared/crud.scss',
})
export class HostFamiliesPage implements OnInit {
  protected readonly tableColumns: readonly DataTableColumn<HostFamily>[] = [
    { key: 'family', label: 'Famille', type: 'text', value: (x) => x.familyName, presentation: { type: 'icon', icon: () => '@tui.house' } },
    { key: 'city', label: 'Ville', type: 'list', value: (x) => `${x.postalCode} ${x.city}`, presentation: { type: 'chip', autoColor: true, icon: () => '@tui.map-pin' } },
    { key: 'capacity', label: 'Capacité', type: 'number', value: (x) => `${x.maxCapacity} places`, filterValue: (x) => x.maxCapacity, sorter: (a, b) => a.maxCapacity - b.maxCapacity, presentation: { type: 'number' } },
  ];
  private api = inject(HostFamiliesApiService);
  items = signal<HostFamily[]>([]);
  query = signal('');
  loading = signal(true);
  opened = signal(false);
  mode = signal<'detail' | 'create' | 'edit'>('detail');
  selected = signal<HostFamily | null>(null);
  model = signal<HostFamilyPayload>(blank());
  familyForm = form(this.model, (p) => {
    required(p.familyName);
    required(p.address);
    required(p.postalCode);
    required(p.city);
    min(p.maxCapacity, 1);
    min(p.maxUnder18, 0);
  });
  filtered = computed(() => {
    const q = this.query().toLowerCase();
    return this.items().filter((x) =>
      `${x.familyName} ${x.city} ${x.postalCode}`.toLowerCase().includes(q),
    );
  });
  ngOnInit() {
    this.api
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((x) => this.items.set(x));
  }
  open(x: HostFamily) {
    this.selected.set(x);
    this.mode.set('detail');
    this.opened.set(true);
  }
  create() {
    this.model.set(blank());
    this.mode.set('create');
    this.opened.set(true);
  }
  edit() {
    const x = this.requireSelectedFamily();
    this.model.set({
      ...x,
      phone: x.phone ?? '',
      email: x.email ?? '',
      parish: x.parish ?? '',
      notes: x.notes ?? '',
    });
    this.mode.set('edit');
  }
  save() {
    submit(this.familyForm, async () => {
      const req =
        this.mode() === 'create'
          ? this.api.create(this.model())
          : this.api.update(this.requireSelectedFamily().id, this.model());
      req.subscribe((x) => {
        this.items.update((a) =>
          this.mode() === 'create' ? [...a, x] : a.map((i) => (i.id === x.id ? x : i)),
        );
        this.open(x);
      });
    });
  }
  remove() {
    const x = this.requireSelectedFamily();
    if (confirm(`Supprimer ${x.familyName} ?`))
      this.api.delete(x.id).subscribe(() => {
        this.items.update((a) => a.filter((i) => i.id !== x.id));
        this.opened.set(false);
      });
  }
  private requireSelectedFamily(): HostFamily {
    const family = this.selected();
    if (!family) {
      throw new Error('No host family selected');
    }
    return family;
  }
}
