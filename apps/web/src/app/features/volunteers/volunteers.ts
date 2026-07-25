import { Component, OnInit, inject, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { finalize } from 'rxjs';
import { Volunteer, VolunteerPayload } from '../../models/models';
import { VolunteersApiService } from '../../services/api.services';
const blank = (): VolunteerPayload => ({
  userId: null,
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  team: '',
  isGroupLeader: false,
  notes: '',
});
@Component({
  selector: 'app-volunteers',
  standalone: false,
  template: `<app-page-layout title="Bénévoles" description="Annuaire et responsabilités"
      ><button actions tuiButton (click)="create()">Nouveau bénévole</button
      ><tui-textfield
        ><input
          tuiTextfield
          placeholder="Rechercher"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
      /></tui-textfield>
      @if (loading()) {
        <tui-loader />
      } @else {
        <cdk-virtual-scroll-viewport itemSize="58" class="viewport"
          ><div class="table-head"><b>Nom</b><b>Équipe</b><b>Contact</b></div>
          <button class="row" *cdkVirtualFor="let x of filtered()" (click)="open(x)">
            <span>{{ x.lastName }} {{ x.firstName }}</span
            ><span>{{ x.team || '—' }}</span
            ><span>{{ x.email || x.phone || '—' }}</span>
          </button></cdk-virtual-scroll-viewport
        >
      }
    </app-page-layout>
    @if (opened()) {
      <tui-drawer direction="end"
        ><header>
          <h2>
            {{
              mode() === 'create'
                ? 'Nouveau bénévole'
                : selected()?.firstName + ' ' + selected()?.lastName
            }}
          </h2>
        </header>
        @if (mode() === 'detail') {
          <dl>
            <dt>Email</dt>
            <dd>{{ selected()?.email || '—' }}</dd>
            <dt>Téléphone</dt>
            <dd>{{ selected()?.phone || '—' }}</dd>
            <dt>Équipe</dt>
            <dd>{{ selected()?.team || '—' }}</dd>
            <dt>Responsable de groupe</dt>
            <dd>{{ selected()?.isGroupLeader ? 'Oui' : 'Non' }}</dd>
            <dt>Notes</dt>
            <dd>{{ selected()?.notes || '—' }}</dd>
          </dl>
        } @else {
          <form class="drawer-form">
            <label>Prénom<input tuiTextfield [formField]="volunteerForm.firstName" /></label
            ><label>Nom<input tuiTextfield [formField]="volunteerForm.lastName" /></label
            ><label
              >Email<input tuiTextfield type="email" [formField]="volunteerForm.email" /></label
            ><label>Téléphone<input tuiTextfield [formField]="volunteerForm.phone" /></label
            ><label>Équipe<input tuiTextfield [formField]="volunteerForm.team" /></label
            ><label class="check"
              ><input type="checkbox" [formField]="volunteerForm.isGroupLeader" /> Responsable de
              groupe</label
            ><label
              >Notes<textarea tuiTextfield [formField]="volunteerForm.notes"></textarea>
            </label>
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
export class VolunteersPage implements OnInit {
  private api = inject(VolunteersApiService);
  items = signal<Volunteer[]>([]);
  query = signal('');
  loading = signal(true);
  opened = signal(false);
  mode = signal<'detail' | 'create' | 'edit'>('detail');
  selected = signal<Volunteer | null>(null);
  model = signal<VolunteerPayload>(blank());
  volunteerForm = form(this.model, (p) => {
    required(p.firstName);
    required(p.lastName);
  });
  filtered = () => {
    const q = this.query().toLowerCase();
    return this.items().filter((x) =>
      `${x.firstName} ${x.lastName} ${x.team ?? ''}`.toLowerCase().includes(q),
    );
  };
  ngOnInit() {
    this.api
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((x) => this.items.set(x));
  }
  open(x: Volunteer) {
    this.selected.set(x);
    this.mode.set('detail');
    this.opened.set(true);
  }
  create() {
    this.model.set(blank());
    this.selected.set(null);
    this.mode.set('create');
    this.opened.set(true);
  }
  edit() {
    const x = this.selected()!;
    this.model.set({
      userId: x.user?.id ?? null,
      firstName: x.firstName,
      lastName: x.lastName,
      phone: x.phone ?? '',
      email: x.email ?? '',
      team: x.team ?? '',
      isGroupLeader: x.isGroupLeader,
      notes: x.notes ?? '',
    });
    this.mode.set('edit');
  }
  save() {
    submit(this.volunteerForm, async () => {
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
    if (confirm(`Supprimer ${x.firstName} ${x.lastName} ?`))
      this.api.delete(x.id).subscribe(() => {
        this.items.update((a) => a.filter((i) => i.id !== x.id));
        this.opened.set(false);
      });
  }
}
