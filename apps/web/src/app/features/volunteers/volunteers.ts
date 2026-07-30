import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { finalize } from 'rxjs';
import { Volunteer, VolunteerPayload } from '../../models/models';
import { VolunteersApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { DataTableColumn } from '../../shared/data-table';
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
  standalone: true,
  imports: [...SHARED_IMPORTS],
  template: `<app-page-layout title="Bénévoles" description="Annuaire et responsabilités">
      <button actions tuiButton (click)="create()">Nouveau bénévole</button>
      <tui-textfield iconStart="@tui.search">
        <label tuiLabel>Rechercher un bénévole</label>
        <input tuiInput placeholder="Nom, équipe…" [value]="query()" (input)="query.set($any($event.target).value)" />
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
             <tui-textfield iconStart="@tui.user">
               <label tuiLabel>Prénom</label>
               <input tuiInput [formField]="volunteerForm.firstName" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.user">
               <label tuiLabel>Nom</label>
               <input tuiInput [formField]="volunteerForm.lastName" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.mail">
               <label tuiLabel>Email</label>
               <input tuiInput type="email" [formField]="volunteerForm.email" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.phone">
               <label tuiLabel>Téléphone</label>
               <input tuiInput [formField]="volunteerForm.phone" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.users">
               <label tuiLabel>Équipe</label>
               <input tuiInput [formField]="volunteerForm.team" />
             </tui-textfield>
             <label class="check">
               <input type="checkbox" [formField]="volunteerForm.isGroupLeader" /> Responsable de groupe
             </label>
             <tui-textfield iconStart="@tui.file-text" class="wide">
               <label tuiLabel>Notes</label>
               <textarea tuiTextarea [formField]="$any(volunteerForm.notes)"></textarea>
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
export class VolunteersPage implements OnInit {
  protected readonly tableColumns: readonly DataTableColumn<Volunteer>[] = [
    { key: 'name', label: 'Nom', value: (x) => `${x.lastName} ${x.firstName}` },
    { key: 'team', label: 'Équipe', value: (x) => x.team || '—' },
    { key: 'contact', label: 'Contact', value: (x) => x.email || x.phone || '—' },
  ];
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
  filtered = computed(() => {
    const q = this.query().toLowerCase();
    return this.items().filter((x) =>
      `${x.firstName} ${x.lastName} ${x.team ?? ''}`.toLowerCase().includes(q),
    );
  });
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
    const x = this.requireSelectedVolunteer();
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
          : this.api.update(this.requireSelectedVolunteer().id, this.model());
      req.subscribe((x) => {
        this.items.update((a) =>
          this.mode() === 'create' ? [...a, x] : a.map((i) => (i.id === x.id ? x : i)),
        );
        this.open(x);
      });
    });
  }
  remove() {
    const x = this.requireSelectedVolunteer();
    if (confirm(`Supprimer ${x.firstName} ${x.lastName} ?`))
      this.api.delete(x.id).subscribe(() => {
        this.items.update((a) => a.filter((i) => i.id !== x.id));
        this.opened.set(false);
      });
  }
  private requireSelectedVolunteer(): Volunteer {
    const volunteer = this.selected();
    if (!volunteer) {
      throw new Error('No volunteer selected');
    }
    return volunteer;
  }
}
