import { Component, OnInit, inject, signal } from '@angular/core';
import { form, min, required, submit } from '@angular/forms/signals';
import { finalize } from 'rxjs';
import { HostFamily, HostFamilyPayload } from '../../models/models';
import { HostFamiliesApiService } from '../../services/api.services';
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
});
@Component({
  selector: 'app-host-families',
  standalone: false,
  template: `<app-page-layout title="Familles d'accueil" description="Capacités et coordonnées"
      ><button actions tuiButton (click)="create()">Nouvelle famille</button
      ><tui-textfield
        ><input
          tuiTextfield
          placeholder="Rechercher une famille ou une ville"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
      /></tui-textfield>
      @if (loading()) {
        <tui-loader />
      } @else {
        <cdk-virtual-scroll-viewport itemSize="58" class="viewport"
          ><div class="table-head"><b>Famille</b><b>Ville</b><b>Capacité</b></div>
          <button class="row" *cdkVirtualFor="let x of filtered()" (click)="open(x)">
            <span>{{ x.familyName }}</span
            ><span>{{ x.postalCode }} {{ x.city }}</span
            ><span>{{ x.maxCapacity }} places</span>
          </button></cdk-virtual-scroll-viewport
        >
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
            <label>Nom<input tuiTextfield [formField]="familyForm.familyName" /></label
            ><label>Adresse<input tuiTextfield [formField]="familyForm.address" /></label
            ><label>Code postal<input tuiTextfield [formField]="familyForm.postalCode" /></label
            ><label>Ville<input tuiTextfield [formField]="familyForm.city" /></label
            ><label>Email<input tuiTextfield type="email" [formField]="familyForm.email" /></label
            ><label>Téléphone<input tuiTextfield [formField]="familyForm.phone" /></label
            ><label
              >Capacité<input
                tuiTextfield
                type="number"
                [formField]="familyForm.maxCapacity" /></label
            ><label
              >Capacité mineurs<input
                tuiTextfield
                type="number"
                [formField]="familyForm.maxUnder18" /></label
            ><label>Paroisse<input tuiTextfield [formField]="familyForm.parish" /></label
            ><label>Notes<textarea tuiTextfield [formField]="familyForm.notes"></textarea></label>
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
  filtered = () => {
    const q = this.query().toLowerCase();
    return this.items().filter((x) =>
      `${x.familyName} ${x.city} ${x.postalCode}`.toLowerCase().includes(q),
    );
  };
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
    const x = this.selected()!;
    this.model.set({...x, phone:x.phone??'', email:x.email??'', parish:x.parish??'', notes:x.notes??''});
    this.mode.set('edit');
  }
  save() {
    submit(this.familyForm, async () => {
      const req =
        this.mode() === 'create'
          ? this.api.create(this.model())
          : this.api.update(this.selected()!.id, this.model());
      req.subscribe((x) => {
        this.items.update((a) =>
          this.mode() === 'create' ? [...a, x] : a.map((i) => (i.id === x.id ? x : i)),
        );
        this.open(x);
      });
    });
  }
  remove() {
    const x = this.selected()!;
    if (confirm(`Supprimer ${x.familyName} ?`))
      this.api.delete(x.id).subscribe(() => {
        this.items.update((a) => a.filter((i) => i.id !== x.id));
        this.opened.set(false);
      });
  }
}
