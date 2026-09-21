import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { debounceTime, distinctUntilChanged, finalize, Subject, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import {
  SkillCount,
  Volunteer,
  VolunteerPayload,
  VolunteerSkill,
  VolunteerSkillType,
  VolunteerTag,
  VolunteerTeam,
  VolunteerTeamMembership,
  VolunteerTeamMembershipPayload,
  VolunteerShiftAssignment,
  VolunteerShiftAssignmentStatus,
} from '../../models/models';
import {
  VolunteerSkillsApiService,
  VolunteerShiftAssignmentsApiService,
  VolunteerTagsApiService,
  VolunteerTeamsApiService,
  VolunteerTeamMembershipsApiService,
  VolunteersApiService,
} from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { DataTableColumn } from '../../shared/data-table';

const SKILL_LABELS: Record<VolunteerSkillType, string> = {
  [VolunteerSkillType.SECURITY]: 'Sécurité',
  [VolunteerSkillType.ANIMATION]: 'Animation',
  [VolunteerSkillType.LITURGY]: 'Liturgie',
  [VolunteerSkillType.LOGISTICS]: 'Logistique',
  [VolunteerSkillType.HEALTH]: 'Santé',
  [VolunteerSkillType.RECEPTION]: 'Accueil',
  [VolunteerSkillType.TRANSPORT]: 'Transport',
  [VolunteerSkillType.ACCOMMODATION]: 'Hébergement',
  [VolunteerSkillType.COMMUNICATION]: 'Communication',
  [VolunteerSkillType.CATERING]: 'Restauration',
  [VolunteerSkillType.CLEANING]: 'Nettoyage',
  [VolunteerSkillType.MISCELLANEOUS]: 'Divers',
  [VolunteerSkillType.OTHER]: 'Autre',
};

const ALL_SKILL_TYPES: VolunteerSkillType[] = Object.values(VolunteerSkillType);

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
        <label for="rechercher-un-benevole" tuiLabel>Rechercher un bénévole</label><input tuiInput placeholder="Nom, équipe…" [value]="query()" (input)="query.set($any($event.target).value)" id="rechercher-un-benevole" />
      </tui-textfield>
      <div class="filter-row">
        <label class="filter-label">
          <span>Compétence</span>
          <select class="filter-select" (change)="onSkillFilterChange($any($event.target).value)">
            <option value="">Toutes</option>
            @for (s of allSkillTypes; track s) {
              <option [value]="s">{{ skillLabel(s) }}@if (skillCountFor(s); as c) { ({{ c }})}
              </option>
            }
          </select>
        </label>
        <label class="filter-label">
          <span>Tag</span>
          <input class="filter-input" list="tag-suggestions-list" placeholder="Filtrer par tag…"
            [value]="tagFilter()"
            (input)="tagFilter.set($any($event.target).value)"
          />
        </label>
        <datalist id="tag-suggestions-list">
          @for (s of filterTagSuggestions(); track s) {
            <option [value]="s"></option>
          }
        </datalist>
      </div>
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

          <!-- Section Compétences -->
          <section class="skill-section">
            <h3>Compétences</h3>
            <div class="chip-list">
              @for (s of skills(); track s.id) {
                <span class="skill-chip">
                  {{ skillLabel(s.skill) }}
                  @if (canEditSkills()) {
                    <button type="button" class="chip-remove" (click)="removeSkill(s.id)" aria-label="Retirer">×</button>
                  }
                </span>
              }
              @if (skills().length === 0) {
                <span class="empty-hint">Aucune compétence enregistrée.</span>
              }
            </div>
            @if (canEditSkills()) {
              <div class="chip-add-row">
                <select class="skill-select" [value]="newSkill()" (change)="newSkill.set($any($event.target).value || null)">
                  <option value="">Choisir une compétence…</option>
                  @for (s of availableSkills(); track s) {
                    <option [value]="s">{{ skillLabel(s) }}</option>
                  }
                </select>
                <button tuiButton size="s" type="button" [disabled]="!newSkill()" (click)="addSkill()">Ajouter</button>
              </div>
            }
          </section>

          <!-- Section Tags -->
          <section class="tag-section">
            <h3>Tags</h3>
            <div class="chip-list">
              @for (t of tags(); track t.id) {
                <span class="tag-chip">
                  {{ t.value }}
                  @if (canEditSkills()) {
                    <button type="button" class="chip-remove" (click)="removeTag(t.id)" aria-label="Retirer">×</button>
                  }
                </span>
              }
              @if (tags().length === 0) {
                <span class="empty-hint">Aucun tag enregistré.</span>
              }
            </div>
            @if (canEditSkills()) {
              <div class="chip-add-row">
                <input
                  list="drawer-tag-suggestions"
                  class="tag-input"
                  placeholder="Nouveau tag…"
                  [value]="newTag()"
                  (input)="onNewTagInput($any($event.target).value)"
                />
                <datalist id="drawer-tag-suggestions">
                  @for (s of drawerTagSuggestions(); track s) {
                    <option [value]="s"></option>
                  }
                </datalist>
                <button tuiButton size="s" type="button" [disabled]="!newTag().trim()" (click)="addTag()">Ajouter</button>
              </div>
            }
          </section>

          <section class="planning-section">
            <h3>Planning des affectations</h3>
            <label class="filter-label">
              <span>Statut</span>
              <select class="filter-select" [value]="planningStatusFilter()" (change)="setPlanningStatusFilter($any($event.target).value)">
                <option value="">Tous</option>
                <option value="PROVISIONAL">Provisoire</option>
                <option value="CONFIRMED">Confirmée</option>
                <option value="CANCELLED">Annulée</option>
              </select>
            </label>
            @if (volunteerPlanning().length === 0) {
              <p>Aucune affectation de shift.</p>
            } @else {
              <ul class="membership-list">
                @for (assignment of volunteerPlanning(); track assignment.id) {
                  <li class="membership-item">
                    <div>
                      <strong>{{ assignment.shift?.mission?.title || 'Mission' }}</strong>
                      <div>{{ assignment.shift?.startAt | date: 'short' }} → {{ assignment.shift?.endAt | date: 'short' }}</div>
                      <small>{{ assignment.status }}</small>
                    </div>
                  </li>
                }
              </ul>
            }
          </section>

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
                     <label for="equipe-operationnelle" tuiLabel>Équipe opérationnelle</label><select tuiSelect placeholder="Choisir…" [items]="activeTeamIds()" [formField]="membershipForm.volunteerTeamId" id="equipe-operationnelle"></select>
                   </tui-textfield>
                   <tui-textfield iconStart="@tui.calendar">
                     <label for="debut-2" tuiLabel>Début</label><input tuiInput type="date" [formField]="membershipForm.startAt" id="debut-2" />
                   </tui-textfield>
                   <tui-textfield iconStart="@tui.calendar">
                     <label for="fin-2" tuiLabel>Fin</label><input tuiInput type="date" [formField]="membershipForm.endAt" id="fin-2" />
                   </tui-textfield>
                   <tui-textfield iconStart="@tui.file-text" class="wide">
                     <label for="role-2" tuiLabel>Rôle</label><input tuiInput [formField]="membershipForm.role" id="role-2" />
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
                     <label for="equipe-operationnelle-1" tuiLabel>Équipe opérationnelle</label><select tuiSelect placeholder="Choisir…" [items]="activeTeamIds()" [formField]="membershipForm.volunteerTeamId" id="equipe-operationnelle-1"></select>
                   </tui-textfield>
                   <tui-textfield iconStart="@tui.calendar">
                     <label for="debut-3" tuiLabel>Début</label><input tuiInput type="date" [formField]="membershipForm.startAt" id="debut-3" />
                   </tui-textfield>
                   <tui-textfield iconStart="@tui.calendar">
                     <label for="fin-3" tuiLabel>Fin</label><input tuiInput type="date" [formField]="membershipForm.endAt" id="fin-3" />
                   </tui-textfield>
                   <tui-textfield iconStart="@tui.file-text" class="wide">
                     <label for="role-3" tuiLabel>Rôle</label><input tuiInput [formField]="membershipForm.role" id="role-3" />
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
               <label for="prenom-2" tuiLabel>Prénom</label><input tuiInput [formField]="volunteerForm.firstName" id="prenom-2" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.user">
               <label for="nom-2" tuiLabel>Nom</label><input tuiInput [formField]="volunteerForm.lastName" id="nom-2" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.mail">
               <label for="email-2" tuiLabel>Email</label><input tuiInput type="email" [formField]="volunteerForm.email" id="email-2" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.phone">
               <label for="telephone-2" tuiLabel>Téléphone</label><input tuiInput [formField]="volunteerForm.phone" id="telephone-2" />
             </tui-textfield>
             <tui-textfield iconStart="@tui.users">
               <label for="equipe-3" tuiLabel>Équipe</label><input tuiInput [formField]="volunteerForm.team" id="equipe-3" />
             </tui-textfield>
             <label class="check">
               <input type="checkbox" [formField]="volunteerForm.isGroupLeader" /> Responsable de groupe
             </label>
             <tui-textfield iconStart="@tui.file-text" class="wide">
               <label for="notes-2" tuiLabel>Notes</label><textarea tuiTextarea [formField]="$any(volunteerForm.notes)" id="notes-2"></textarea>
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
  styles: [`
    .filter-row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; align-items: flex-end; }
    .filter-label { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 160px; font-size: 0.85rem; color: var(--tui-text-secondary, #666); }
    .filter-select, .filter-input {
      padding: 0.4rem 0.5rem; border: 1px solid var(--tui-border-normal, #ccc);
      border-radius: 4px; font-size: 0.9rem; background: var(--tui-background-base, #fff);
    }
    .filter-row tui-textfield { flex: 1; min-width: 160px; }
    .chip-list { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.5rem 0; }
    .skill-chip, .tag-chip {
      display: inline-flex; align-items: center; gap: 0.25rem;
      padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.8rem;
    }
    .skill-chip { background: var(--tui-status-info-pale, #e3f0ff); color: var(--tui-text-primary, #333); }
    .tag-chip { background: var(--tui-status-neutral-pale, #f0f0f0); color: var(--tui-text-primary, #333); }
    .chip-remove { background: none; border: none; cursor: pointer; padding: 0; line-height: 1; font-size: 1rem; opacity: 0.6; }
    .chip-remove:hover { opacity: 1; }
    .chip-add-row { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem; }
    .skill-select, .tag-input {
      flex: 1; padding: 0.35rem 0.5rem; border: 1px solid var(--tui-border-normal, #ccc);
      border-radius: 4px; font-size: 0.9rem; background: var(--tui-background-base, #fff);
    }
    .empty-hint { font-size: 0.8rem; color: var(--tui-text-tertiary, #999); }
    .skill-section, .tag-section { margin-top: 1.25rem; }
  `],
  styleUrl: '../../shared/crud.scss',
})
export class VolunteersPage implements OnInit {
  protected readonly tableColumns: readonly DataTableColumn<Volunteer>[] = [
    { key: 'name', label: 'Nom', type: 'text', value: (x) => `${x.lastName} ${x.firstName}`, presentation: { type: 'person', subtitle: (x) => x.email || x.phone } },
    { key: 'team', label: 'Équipe', type: 'list', value: (x) => x.team || '—', presentation: { type: 'chip', autoColor: true, icon: () => '@tui.users' } },
    { key: 'contact', label: 'Contact', type: 'text', value: (x) => x.email || x.phone || '—', presentation: { type: 'icon', icon: (x) => x.email ? '@tui.mail' : '@tui.phone' } },
  ];

  readonly allSkillTypes = ALL_SKILL_TYPES;

  private api = inject(VolunteersApiService);
  private readonly teamsApi = inject(VolunteerTeamsApiService);
  private readonly membershipsApi = inject(VolunteerTeamMembershipsApiService);
  private readonly skillsApi = inject(VolunteerSkillsApiService);
  private readonly tagsApi = inject(VolunteerTagsApiService);
  private readonly shiftAssignmentsApi = inject(VolunteerShiftAssignmentsApiService);
  private readonly auth = inject(AuthService);

  items = signal<Volunteer[]>([]);
  teams = signal<VolunteerTeam[]>([]);
  teamMemberships = signal<VolunteerTeamMembership[]>([]);
  skills = signal<VolunteerSkill[]>([]);
  tags = signal<VolunteerTag[]>([]);
  volunteerPlanning = signal<VolunteerShiftAssignment[]>([]);
  planningStatusFilter = signal<VolunteerShiftAssignmentStatus | ''>('');
  skillCounts = signal<SkillCount[]>([]);
  filterTagSuggestions = signal<string[]>([]);
  drawerTagSuggestions = signal<string[]>([]);
  query = signal('');
  skillFilter = signal<VolunteerSkillType | null>(null);
  tagFilter = signal<string>('');
  newSkill = signal<VolunteerSkillType | null>(null);
  newTag = signal<string>('');
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
  readonly canEditSkills = computed(() => this.auth.hasAnyRole(['ADMIN', 'COORDINATOR', 'HEALTH', 'VOLUNTEERS', 'LOGISTICS']));
  readonly activeTeamIds = computed(() => this.teams().filter((team) => team.isActive).map(({ id }) => id));
  readonly availableSkills = computed(() => {
    const used = new Set(this.skills().map((s) => s.skill));
    return ALL_SKILL_TYPES.filter((s) => !used.has(s));
  });

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

  skillLabel = (skill: VolunteerSkillType): string => SKILL_LABELS[skill];

  skillCountFor(skill: VolunteerSkillType): number | null {
    const entry = this.skillCounts().find((c) => c.skill === skill);
    return entry ? entry.count : null;
  }

  private readonly filterTagInput$ = new Subject<string>();

  constructor() {
    // Reload list when skill or tag filter changes
    effect(() => {
      const skill = this.skillFilter();
      const tag = this.tagFilter();
      this.loading.set(true);
      this.api
        .listFiltered({ skill: skill ?? undefined, tag: tag || undefined })
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe((x) => this.items.set(x));
    });

    // Debounced suggestions for filter tag input
    this.filterTagInput$
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((q) => this.tagsApi.getSuggestions(q || undefined)),
        takeUntilDestroyed(),
      )
      .subscribe((suggestions) => this.filterTagSuggestions.set(suggestions));
  }

  ngOnInit() {
    this.teamsApi.list().subscribe((teams) => this.teams.set(teams));
    this.skillsApi.getCounts().subscribe((counts) => this.skillCounts.set(counts));
    this.tagsApi.getSuggestions().subscribe((s) => this.filterTagSuggestions.set(s));
  }

  open(x: Volunteer) {
    this.selected.set(x);
    this.mode.set('detail');
    this.opened.set(true);
    this.membershipMode.set(null);
    this.selectedMembership.set(null);
    this.membershipModel.set(blankMembership());
    this.newSkill.set(null);
    this.newTag.set('');
    this.drawerTagSuggestions.set([]);
    this.membershipsApi.list(x.id).subscribe((memberships) => this.teamMemberships.set(memberships));
    this.skillsApi.list(x.id).subscribe((s) => this.skills.set(s));
    this.tagsApi.list(x.id).subscribe((t) => this.tags.set(t));
    this.loadVolunteerPlanning(x.id);
  }

  setPlanningStatusFilter(value: string) {
    this.planningStatusFilter.set((value as VolunteerShiftAssignmentStatus) || '');
    const volunteer = this.selected();
    if (volunteer) {
      this.loadVolunteerPlanning(volunteer.id);
    }
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

  onSkillFilterChange(value: string) {
    this.skillFilter.set((value as VolunteerSkillType) || null);
  }

  onNewTagInput(value: string) {
    this.newTag.set(value);
    if (value.trim().length > 0) {
      this.tagsApi.getSuggestions(value).subscribe((s) => this.drawerTagSuggestions.set(s));
    } else {
      this.drawerTagSuggestions.set([]);
    }
  }

  addSkill() {
    const volunteer = this.requireSelectedVolunteer();
    const skill = this.newSkill();
    if (!skill) return;
    this.skillsApi.add(volunteer.id, { skill }).subscribe((s) => {
      this.skills.update((list) => [...list, s]);
      this.newSkill.set(null);
      this.skillCounts.set([]);
      this.skillsApi.getCounts().subscribe((counts) => this.skillCounts.set(counts));
    });
  }

  removeSkill(skillId: number) {
    const volunteer = this.requireSelectedVolunteer();
    if (confirm('Retirer cette compétence ?')) {
      this.skillsApi.remove(volunteer.id, skillId).subscribe(() => {
        this.skills.update((list) => list.filter((s) => s.id !== skillId));
        this.skillsApi.getCounts().subscribe((counts) => this.skillCounts.set(counts));
      });
    }
  }

  addTag() {
    const volunteer = this.requireSelectedVolunteer();
    const value = this.newTag().trim();
    if (!value) return;
    this.tagsApi.add(volunteer.id, { value }).subscribe((t) => {
      this.tags.update((list) => [...list, t]);
      this.newTag.set('');
      this.drawerTagSuggestions.set([]);
      this.tagsApi.getSuggestions().subscribe((s) => this.filterTagSuggestions.set(s));
    });
  }

  removeTag(tagId: number) {
    const volunteer = this.requireSelectedVolunteer();
    if (confirm('Retirer ce tag ?')) {
      this.tagsApi.remove(volunteer.id, tagId).subscribe(() => {
        this.tags.update((list) => list.filter((t) => t.id !== tagId));
        this.tagsApi.getSuggestions().subscribe((s) => this.filterTagSuggestions.set(s));
      });
    }
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

  private loadVolunteerPlanning(volunteerId: number): void {
    this.shiftAssignmentsApi
      .listVolunteerPlanning(volunteerId, this.planningStatusFilter() || undefined)
      .subscribe((planning) => this.volunteerPlanning.set(planning));
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
