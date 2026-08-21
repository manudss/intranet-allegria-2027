import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  Volunteer,
  VolunteerPayload,
  VolunteerTeam,
  VolunteerTeamMembership,
  VolunteerTeamMembershipPayload,
} from '../../models/models';
import {
  VolunteerTeamsApiService,
  VolunteerTeamMembershipsApiService,
  VolunteersApiService,
} from '../../services/api.services';
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
const blankMembership = () => ({
  volunteerTeamId: null,
  startAt: '',
  endAt: '',
  role: '',
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
          @if (canSeeMemberships()) {
           <section class="membership-section">
             <h3>Rattachements opérationnels</h3>
             @if (teamMemberships().length === 0) {
               <p>Aucun rattachement enregistré.</p>
             } @else {
               <ul class="membership-list">
                 @for (membership of teamMemberships(); track membership.id) {
                   <li class="membership-item">
                     <div>
                       <strong>{{ membership.volunteerTeam.name }}</strong>
                       <div>{{ formatPeriod(membership.startAt, membership.endAt) }}</div>
                       <small>{{ membership.role || 'Sans role' }}</small>
                     </div>
                     @if (canEditMemberships()) {
                       <div class="membership-actions-inline">
                         <button tuiButton size="s" appearance="secondary" type="button" (click)="editMembership(membership)">
                           Modifier
                         </button>
                         <button tuiButton size="s" appearance="secondary-destructive" type="button" (click)="removeMembership(membership.id)">
                           Retirer
                         </button>
                       </div>
                     }
                   </li>
                 }
               </ul>
             }

             @if (canEditMemberships()) {
               @if (membershipMode() === 'edit') {
                 <h4>Modifier un rattachement</h4>
                 <form class="drawer-form membership-form">
                   <tui-textfield iconStart="@tui.users" tuiChevron [stringify]="stringifyVolunteerTeam">
                     <label tuiLabel>Équipe opérationnelle</label>
                     <select tuiSelect placeholder="Choisir…" [items]="activeTeamIds()" [formField]="membershipForm.volunteerTeamId"></select>
                   </tui-textfield>
                   <tui-textfield iconStart="@tui.calendar">
                     <label tuiLabel>Début</label>
                     <input tuiInput type="date" [formField]="membershipForm.startAt" />
                   </tui-textfield>
                   <tui-textfield iconStart="@tui.calendar">
                     <label tuiLabel>Fin</label>
                     <input tuiInput type="date" [formField]="membershipForm.endAt" />
                   </tui-textfield>
                   <tui-textfield iconStart="@tui.file-text" class="wide">
                     <label tuiLabel>Rôle</label>
                     <input tuiInput [formField]="membershipForm.role" />
                   </tui-textfield>
                 </form>
                 <div class="membership-form-actions">
                   <button tuiButton appearance="flat" type="button" (click)="cancelMembershipEdit()">Annuler</button>
                   <button tuiButton type="button" (click)="saveMembership()">Mettre à jour</button>
                 </div>
               } @else if (membershipMode() === 'create') {
                 <h4>Ajouter un rattachement</h4>
                 <form class="drawer-form membership-form">
                   <tui-textfield iconStart="@tui.users" tuiChevron [stringify]="stringifyVolunteerTeam">
                     <label tuiLabel>Équipe opérationnelle</label>
                     <select tuiSelect placeholder="Choisir…" [items]="activeTeamIds()" [formField]="membershipForm.volunteerTeamId"></select>
                   </tui-textfield>
                   <tui-textfield iconStart="@tui.calendar">
                     <label tuiLabel>Début</label>
                     <input tuiInput type="date" [formField]="membershipForm.startAt" />
                   </tui-textfield>
                   <tui-textfield iconStart="@tui.calendar">
                     <label tuiLabel>Fin</label>
                     <input tuiInput type="date" [formField]="membershipForm.endAt" />
                   </tui-textfield>
                   <tui-textfield iconStart="@tui.file-text" class="wide">
                     <label tuiLabel>Rôle</label>
                     <input tuiInput [formField]="membershipForm.role" />
                   </tui-textfield>
                 </form>
                 <div class="membership-form-actions">
                   <button tuiButton appearance="flat" type="button" (click)="cancelMembershipEdit()">Annuler</button>
                   <button tuiButton type="button" (click)="saveMembership()">Ajouter</button>
                 </div>
               } @else {
                 <button tuiButton type="button" (click)="createMembership()">Ajouter un rattachement</button>
               }
             }
           </section>
          }
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
    { key: 'name', label: 'Nom', type: 'text', value: (x) => `${x.lastName} ${x.firstName}`, presentation: { type: 'person', subtitle: (x) => x.email || x.phone } },
    { key: 'team', label: 'Équipe', type: 'list', value: (x) => x.team || '—', presentation: { type: 'chip', autoColor: true, icon: () => '@tui.users' } },
    { key: 'contact', label: 'Contact', type: 'text', value: (x) => x.email || x.phone || '—', presentation: { type: 'icon', icon: (x) => x.email ? '@tui.mail' : '@tui.phone' } },
  ];
  private api = inject(VolunteersApiService);
  private readonly teamsApi = inject(VolunteerTeamsApiService);
  private readonly membershipsApi = inject(VolunteerTeamMembershipsApiService);
  private readonly auth = inject(AuthService);
  items = signal<Volunteer[]>([]);
  teams = signal<VolunteerTeam[]>([]);
  teamMemberships = signal<VolunteerTeamMembership[]>([]);
  query = signal('');
  loading = signal(true);
  opened = signal(false);
  mode = signal<'detail' | 'create' | 'edit'>('detail');
  selected = signal<Volunteer | null>(null);
  selectedMembership = signal<VolunteerTeamMembership | null>(null);
  membershipMode = signal<'create' | 'edit' | null>(null);
  model = signal<VolunteerPayload>(blank());
  membershipModel = signal<VolunteerTeamMembershipPayload>(blankMembership());
  volunteerForm = form(this.model, (p) => {
    required(p.firstName);
    required(p.lastName);
  });
  membershipForm = form(this.membershipModel, (p) => {
    required(p.volunteerTeamId);
  });
  readonly canSeeMemberships = computed(() =>
    this.auth.hasAnyRole(['ADMIN', 'COORDINATOR', 'HEALTH', 'VOLUNTEERS', 'LOGISTICS', 'VIEWER']),
  );
  readonly canEditMemberships = computed(() => this.auth.hasAnyRole(['ADMIN', 'COORDINATOR']));
  readonly activeTeamIds = computed(() => this.teams().filter((team) => team.isActive).map(({ id }) => id));
  filtered = computed(() => {
    const q = this.query().toLowerCase();
    return this.items().filter((x) =>
      `${x.firstName} ${x.lastName} ${x.team ?? ''}`.toLowerCase().includes(q),
    );
  });
  stringifyVolunteerTeam = (id: number) => {
    const team = this.teams().find((item) => item.id === id);
    return team ? `${team.code} · ${team.name}` : '';
  };
  ngOnInit() {
    this.loading.set(true);
    this.api
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((x) => this.items.set(x));
    this.teamsApi.list().subscribe((teams) => this.teams.set(teams));
  }
  open(x: Volunteer) {
    this.selected.set(x);
    this.mode.set('detail');
    this.opened.set(true);
    this.membershipMode.set(null);
    this.selectedMembership.set(null);
    this.membershipModel.set(blankMembership());
    this.membershipsApi.list(x.id).subscribe((memberships) => this.teamMemberships.set(memberships));
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
  createMembership() {
    this.membershipModel.set(blankMembership());
    this.selectedMembership.set(null);
    this.membershipMode.set('create');
  }
  editMembership(membership: VolunteerTeamMembership) {
    this.selectedMembership.set(membership);
    this.membershipModel.set({
      volunteerTeamId: membership.volunteerTeam.id,
      startAt: membership.startAt ?? '',
      endAt: membership.endAt ?? '',
      role: membership.role ?? '',
    });
    this.membershipMode.set('edit');
  }
  cancelMembershipEdit() {
    this.selectedMembership.set(null);
    this.membershipModel.set(blankMembership());
    this.membershipMode.set(null);
  }
  saveMembership() {
    const volunteer = this.requireSelectedVolunteer();

    submit(this.membershipForm, async () => {
      const selectedMembership = this.selectedMembership();
      const request =
        this.membershipMode() === 'edit' && selectedMembership
          ? this.membershipsApi.update(volunteer.id, selectedMembership.id, this.membershipModel())
          : this.membershipsApi.create(volunteer.id, this.membershipModel());

      request.subscribe((membership) => {
        this.teamMemberships.update((memberships) =>
          this.membershipMode() === 'edit'
            ? memberships.map((item) => (item.id === membership.id ? membership : item))
            : [membership, ...memberships],
        );
        this.cancelMembershipEdit();
      });
    });
  }
  removeMembership(membershipId: number) {
    const volunteer = this.requireSelectedVolunteer();
    if (confirm('Retirer ce rattachement ?')) {
      this.membershipsApi.delete(volunteer.id, membershipId).subscribe(() => {
        this.teamMemberships.update((memberships) => memberships.filter((item) => item.id !== membershipId));
        if (this.selectedMembership()?.id === membershipId) {
          this.cancelMembershipEdit();
        }
      });
    }
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
  protected formatPeriod(startAt: string | null, endAt: string | null): string {
    if (startAt && endAt) {
      return `${startAt} → ${endAt}`;
    }

    if (startAt) {
      return `À partir du ${startAt}`;
    }

    if (endAt) {
      return `Jusqu'au ${endAt}`;
    }

    return 'Période libre';
  }
}
