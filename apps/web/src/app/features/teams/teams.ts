import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { form, min, required, submit } from '@angular/forms/signals';
import { forkJoin } from 'rxjs';
import { Group, Participant, Team, TeamPayload, Volunteer } from '../../models/models';
import {
  GroupsApiService,
  ParticipantsApiService,
  TeamParticipantsApiService,
  TeamsApiService,
  VolunteersApiService,
} from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
const blank = (): TeamPayload => ({
  name: '',
  groupId: null,
  primaryAnimatorId: null,
  secondaryAnimatorId: null,
  maxSize: 10,
  notes: '',
});
@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  template: `<app-page-layout title="Équipes & missions" description="Composition et animateurs"
      ><button actions tuiButton (click)="create()">Nouvelle équipe</button>
      <div class="filters">
        <tui-textfield iconStart="@tui.search">
          <label tuiLabel>Rechercher une équipe</label>
          <input tuiInput placeholder="Nom d'équipe…" [value]="query()" (input)="query.set($any($event.target).value)" />
        </tui-textfield>
        <tui-textfield iconStart="@tui.filter">
          <label tuiLabel>Groupe</label>
          <select [value]="groupFilter() ?? ''" (change)="groupFilter.set($any($event.target).value ? +$any($event.target).value : null)">
            <option value="">Tous les groupes</option>
            @for (g of groups(); track g.id) {
              <option [value]="g.id">{{ g.name }}</option>
            }
          </select>
        </tui-textfield>
      </div>
      @if (loading()) {
        <tui-loader />
      } @else {
        <cdk-virtual-scroll-viewport itemSize="58" class="viewport"
          ><div class="table-head"><b>Équipe</b><b>Groupe</b><b>Animateur</b></div>
          <button class="row" *cdkVirtualFor="let x of filtered()" (click)="open(x)">
            <span>{{ x.name }}</span
            ><span>{{ x.group?.name || '—' }}</span
            ><span
              >{{ x.primaryAnimator?.firstName || '—' }} {{ x.primaryAnimator?.lastName }}</span
            >
          </button></cdk-virtual-scroll-viewport
        >
      }
    </app-page-layout>
    @if (opened()) {
      <tui-drawer direction="end"
        ><header>
          <h2>{{ mode() === 'create' ? 'Nouvelle équipe' : selected()?.name }}</h2>
        </header>
        @if (mode() === 'detail') {
          <dl>
            <dt>Groupe</dt>
            <dd>{{ selected()?.group?.name || '—' }}</dd>
            <dt>Animateur</dt>
            <dd>
              {{ selected()?.primaryAnimator?.firstName }}
              {{ selected()?.primaryAnimator?.lastName }}
            </dd>
            <dt>Co-animateur</dt>
            <dd>
              {{ selected()?.secondaryAnimator?.firstName || '—' }}
              {{ selected()?.secondaryAnimator?.lastName }}
            </dd>
            <dt>Effectif</dt>
            <dd>
              <span tuiBadge [class.over]="members().length > (selected()?.maxSize || 10)">{{ members().length }} / {{ selected()?.maxSize }}</span>
            </dd>
          </dl>
           <h3>Membres</h3>
           <div class="member-add">
             <tui-textfield iconStart="@tui.user-plus">
               <label tuiLabel>Ajouter un participant</label>
               <select [value]="candidateId() ?? ''" (change)="candidateId.set(+$any($event.target).value)">
                 <option value="">Sélectionner…</option>
                 @for (p of availableParticipants(); track p.id) {
                   <option [value]="p.id">{{ p.lastName }} {{ p.firstName }}</option>
                 }
               </select>
             </tui-textfield>
             <button tuiButton size="s" [disabled]="!candidateId()" (click)="addMember()">Ajouter</button>
           </div>
          <ul>
            @for (p of members(); track p.id) {
              <li>
                {{ p.lastName }} {{ p.firstName }}
                <button tuiButton size="xs" appearance="flat-destructive" (click)="removeMember(p.id)">Retirer</button>
              </li>
            }
          </ul>
         } @else {
           <form class="drawer-form">
             <tui-textfield iconStart="@tui.briefcase">
               <label tuiLabel>Nom de l'équipe</label>
               <input tuiInput [formField]="teamForm.name" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.users">
               <label tuiLabel>Groupe</label>
               <select [value]="model().groupId??''" (change)="model.update(x=>({...x,groupId:$any($event.target).value?+$any($event.target).value:null}))">
                 <option value="">Sans groupe</option>
                 @for (g of groups(); track g.id) {
                   <option [value]="g.id">{{ g.name }}</option>
                 }
               </select>
             </tui-textfield>
             <tui-textfield iconStart="@tui.user-check">
               <label tuiLabel>Animateur</label>
               <select [value]="model().primaryAnimatorId??''" (change)="model.update(x=>({...x,primaryAnimatorId:$any($event.target).value?+$any($event.target).value:null}))">
                 <option value="">Aucun</option>
                 @for (v of volunteers(); track v.id) {
                   <option [value]="v.id">{{ v.lastName }} {{ v.firstName }}</option>
                 }
               </select>
             </tui-textfield>
             <tui-textfield iconStart="@tui.user">
               <label tuiLabel>Co-animateur</label>
               <select [value]="model().secondaryAnimatorId??''" (change)="model.update(x=>({...x,secondaryAnimatorId:$any($event.target).value?+$any($event.target).value:null}))">
                 <option value="">Aucun</option>
                 @for (v of volunteers(); track v.id) {
                   <option [value]="v.id">{{ v.lastName }} {{ v.firstName }}</option>
                 }
               </select>
             </tui-textfield>
             <tui-textfield iconStart="@tui.hash">
               <label tuiLabel>Taille maximale</label>
               <input tuiInput type="number" [formField]="teamForm.maxSize" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.file-text" class="wide">
               <label tuiLabel>Notes</label>
               <textarea tuiTextarea [formField]="$any(teamForm.notes)"></textarea>
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
  styleUrls: ['../../shared/crud.scss', './teams.scss'],
})
export class TeamsPage implements OnInit {
  private api = inject(TeamsApiService);
  private membersApi = inject(TeamParticipantsApiService);
  private groupsApi = inject(GroupsApiService);
  private volunteersApi = inject(VolunteersApiService);
  private participantsApi = inject(ParticipantsApiService);
  items = signal<Team[]>([]);
  groups = signal<Group[]>([]);
  volunteers = signal<Volunteer[]>([]);
  participants = signal<Participant[]>([]);
  members = signal<Participant[]>([]);
  query = signal('');
  groupFilter = signal<number | null>(null);
  candidateId = signal<number | null>(null);
  loading = signal(true);
  opened = signal(false);
  mode = signal<'detail' | 'create' | 'edit'>('detail');
  selected = signal<Team | null>(null);
  model = signal<TeamPayload>(blank());
  teamForm = form(this.model, (p) => {
    required(p.name);
    min(p.maxSize, 1);
  });
  filtered = computed(() => {
    const q = this.query().toLowerCase(),
      g = this.groupFilter();
    return this.items().filter(
      (x) =>
        (!g || x.group?.id === g) && `${x.name} ${x.group?.name ?? ''}`.toLowerCase().includes(q),
    );
  });
  availableParticipants = computed(() => {
    const ids = new Set(this.members().map((x) => x.id));
    return this.participants().filter((x) => !ids.has(x.id));
  });
  ngOnInit() {
    forkJoin({
      items: this.api.list(),
      groups: this.groupsApi.list(),
      volunteers: this.volunteersApi.list(),
      participants: this.participantsApi.list(),
    }).subscribe((x) => {
      this.items.set(x.items);
      this.groups.set(x.groups);
      this.volunteers.set(x.volunteers);
      this.participants.set(x.participants);
      this.loading.set(false);
    });
  }
  open(x: Team) {
    this.selected.set(x);
    this.mode.set('detail');
    this.opened.set(true);
    this.api.getParticipants(x.id).subscribe((v) => this.members.set(v));
  }
  create() {
    this.model.set(blank());
    this.mode.set('create');
    this.opened.set(true);
  }
  edit() {
    const x = this.requireSelectedTeam();
    this.model.set({
      name: x.name,
      groupId: x.group?.id ?? null,
      primaryAnimatorId: x.primaryAnimator?.id ?? null,
      secondaryAnimatorId: x.secondaryAnimator?.id ?? null,
      maxSize: x.maxSize,
      notes: x.notes ?? '',
    });
    this.mode.set('edit');
  }
  save() {
    submit(this.teamForm, async () => {
      const req =
        this.mode() === 'create'
          ? this.api.create(this.model())
          : this.api.update(this.requireSelectedTeam().id, this.model());
      req.subscribe((x) => {
        this.items.update((a) =>
          this.mode() === 'create' ? [...a, x] : a.map((i) => (i.id === x.id ? x : i)),
        );
        this.open(x);
      });
    });
  }
  remove() {
    const x = this.requireSelectedTeam();
    if (confirm(`Supprimer ${x.name} ?`))
      this.api.delete(x.id).subscribe(() => {
        this.items.update((a) => a.filter((i) => i.id !== x.id));
        this.opened.set(false);
      });
  }
  addMember() {
    const id = this.candidateId();
    const team = this.selected();
    if (id && team)
      this.membersApi.add(team.id, id).subscribe(() => {
        const p = this.participants().find((x) => x.id === id);
        if (p) this.members.update((a) => [...a, p]);
        this.candidateId.set(null);
      });
  }
  removeMember(id: number) {
    const team = this.selected();
    if (team)
      this.membersApi
        .remove(team.id, id)
        .subscribe(() => this.members.update((a) => a.filter((x) => x.id !== id)));
  }
  private requireSelectedTeam(): Team {
    const team = this.selected();
    if (!team) {
      throw new Error('No team selected');
    }
    return team;
  }
}
