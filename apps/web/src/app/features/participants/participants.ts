import { Component, OnInit, inject, signal } from '@angular/core';
import { form, required, submit } from '@angular/forms/signals';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  Group,
  Participant,
  ParticipantHealth,
  ParticipantHealthPayload,
  ParticipantPayload,
  ParticipantSex,
} from '../../models/models';
import {
  GroupsApiService,
  HealthApiService,
  ParticipantsApiService,
} from '../../services/api.services';
const blank = (): ParticipantPayload => ({
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  sex: ParticipantSex.UNDISCLOSED,
  emergencyContactName: '',
  emergencyContactPhone: '',
  diocese: '',
  city: '',
  groupId: null,
});
const blankHealth = (): ParticipantHealthPayload => ({
  medicalConditions: '',
  allergies: '',
  medications: '',
  specialNeeds: '',
  dietaryNotes: '',
  emergencyInstructions: '',
});
@Component({
  selector: 'app-participants',
  standalone: false,
  template: `<app-page-layout
      title="Participants"
      description="Inscriptions, groupes et informations individuelles"
      ><button actions tuiButton (click)="create()">Nouveau participant</button>
      <div class="filters">
        <tui-textfield
          ><input
            tuiTextfield
            placeholder="Nom, diocèse ou ville"
            [value]="query()"
            (input)="query.set($any($event.target).value)" /></tui-textfield
        ><select
          tuiTextfield
          [value]="groupFilter() ?? ''"
          (change)="setGroupFilter($any($event.target).value)"
        >
          <option value="">Tous les groupes</option>
          @for (g of groups(); track g.id) {
            <option [value]="g.id">{{ g.name }}</option>
          }
        </select>
      </div>
      @if (loading()) {
        <tui-loader />
      } @else {
        <cdk-virtual-scroll-viewport itemSize="58" class="viewport"
          ><div class="table-head"><b>Participant</b><b>Groupe</b><b>Diocèse</b></div>
          <button class="row" *cdkVirtualFor="let x of filtered()" (click)="open(x)">
            <span>{{ x.lastName }} {{ x.firstName }}</span
            ><span>{{ x.group?.name || 'Sans groupe' }}</span
            ><span>{{ x.diocese || '—' }}</span>
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
                ? 'Nouveau participant'
                : selected()?.firstName + ' ' + selected()?.lastName
            }}
          </h2>
        </header>
        @if (mode() === 'detail') {
          <dl>
            <dt>Naissance</dt>
            <dd>{{ selected()?.dateOfBirth | date }}</dd>
            <dt>Sexe</dt>
            <dd>{{ selected()?.sex }}</dd>
            <dt>Groupe</dt>
            <dd>{{ selected()?.group?.name || '—' }}</dd>
            <dt>Ville</dt>
            <dd>{{ selected()?.city || '—' }}</dd>
            <dt>Contact urgence</dt>
            <dd>
              {{ selected()?.emergencyContactName || '—' }} ·
              {{ selected()?.emergencyContactPhone || '—' }}
            </dd>
          </dl>
        } @else if (mode() === 'health') {
          <form class="drawer-form">
            <label
              >Pathologies<textarea
                tuiTextfield
                [formField]="healthForm.medicalConditions"
              ></textarea></label
            ><label
              >Allergies<textarea tuiTextfield [formField]="healthForm.allergies"></textarea></label
            ><label
              >Médicaments<textarea
                tuiTextfield
                [formField]="healthForm.medications"
              ></textarea></label
            ><label
              >Besoins spécifiques<textarea
                tuiTextfield
                [formField]="healthForm.specialNeeds"
              ></textarea></label
            ><label
              >Alimentation<textarea
                tuiTextfield
                [formField]="healthForm.dietaryNotes"
              ></textarea></label
            ><label
              >Consignes d'urgence<textarea
                tuiTextfield
                [formField]="healthForm.emergencyInstructions"
              ></textarea>
            </label>
          </form>
          @if (health()) {
            <p>
              Dernière modification : {{ health()?.lastUpdatedAt | date: 'short' }} par
              {{ health()?.lastUpdatedBy?.email || 'inconnu' }}
            </p>
          }
        } @else {
          <form class="drawer-form">
            <label>Prénom<input tuiTextfield [formField]="participantForm.firstName" /></label
            ><label>Nom<input tuiTextfield [formField]="participantForm.lastName" /></label
            ><label
              >Date de naissance<input
                tuiTextfield
                type="date"
                [formField]="participantForm.dateOfBirth" /></label
            ><label
              >Sexe<select tuiTextfield [formField]="participantForm.sex">
                @for (s of sexes; track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select></label
            ><label
              >Groupe<select tuiTextfield [value]="model().groupId??''" (change)="model.update(x=>({...x,groupId:$any($event.target).value?+$any($event.target).value:null}))">
                <option value="">Sans groupe</option>
                @for (g of groups(); track g.id) {
                  <option [value]="g.id">{{ g.name }}</option>
                }
              </select></label
            ><label>Diocèse<input tuiTextfield [formField]="participantForm.diocese" /></label
            ><label>Ville<input tuiTextfield [formField]="participantForm.city" /></label
            ><label
              >Contact urgence<input
                tuiTextfield
                [formField]="participantForm.emergencyContactName" /></label
            ><label
              >Téléphone urgence<input
                tuiTextfield
                [formField]="participantForm.emergencyContactPhone"
            /></label>
          </form>
        }
        <footer>
          <button tuiButton appearance="flat" (click)="opened.set(false)">Fermer</button>
          @if (mode() === 'detail') {
            @if (canSeeHealth) {
              <button tuiButton appearance="secondary" (click)="openHealth()">Santé</button>
            }
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
  styleUrls: ['../../shared/crud.scss', './participants.scss'],
})
export class ParticipantsPage implements OnInit {
  private api = inject(ParticipantsApiService);
  private groupsApi = inject(GroupsApiService);
  private healthApi = inject(HealthApiService);
  private auth = inject(AuthService);
  items = signal<Participant[]>([]);
  groups = signal<Group[]>([]);
  query = signal('');
  groupFilter = signal<number | null>(null);
  loading = signal(true);
  opened = signal(false);
  mode = signal<'detail' | 'create' | 'edit' | 'health'>('detail');
  selected = signal<Participant | null>(null);
  health = signal<ParticipantHealth | null>(null);
  model = signal<ParticipantPayload>(blank());
  healthModel = signal<ParticipantHealthPayload>(blankHealth());
  participantForm = form(this.model, (p) => {
    required(p.firstName);
    required(p.lastName);
    required(p.dateOfBirth);
    required(p.sex);
  });
  healthForm = form(this.healthModel);
  sexes = Object.values(ParticipantSex);
  get canSeeHealth() {
    return this.auth.hasAnyRole(['ADMIN', 'HEALTH']);
  }
  filtered = () => {
    const q = this.query().toLowerCase();
    const gid = this.groupFilter();
    return this.items().filter(
      (x) =>
        (!gid || x.group?.id === gid) &&
        `${x.firstName} ${x.lastName} ${x.diocese ?? ''} ${x.city ?? ''}`.toLowerCase().includes(q),
    );
  };
  ngOnInit() {
    forkJoin({ items: this.api.getParticipants(), groups: this.groupsApi.list() }).subscribe(
      (x) => {
        this.items.set(x.items);
        this.groups.set(x.groups);
        this.loading.set(false);
      },
    );
  }
  setGroupFilter(v: string) {
    this.groupFilter.set(v ? Number(v) : null);
  }
  open(x: Participant) {
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
    this.model.set({
      firstName: x.firstName,
      lastName: x.lastName,
      dateOfBirth: x.dateOfBirth,
      sex: x.sex,
      emergencyContactName: x.emergencyContactName ?? '',
      emergencyContactPhone: x.emergencyContactPhone ?? '',
      diocese: x.diocese ?? '',
      city: x.city ?? '',
      groupId: x.group?.id ?? null,
    });
    this.mode.set('edit');
  }
  openHealth() {
    this.healthApi.getParticipantHealth(this.selected()!.id).subscribe((x) => {
      this.health.set(x);
      this.healthModel.set(
        x
          ? {
              medicalConditions: x.medicalConditions ?? '',
              allergies: x.allergies ?? '',
              medications: x.medications ?? '',
              specialNeeds: x.specialNeeds ?? '',
              dietaryNotes: x.dietaryNotes ?? '',
              emergencyInstructions: x.emergencyInstructions ?? '',
            }
          : blankHealth(),
      );
      this.mode.set('health');
    });
  }
  save() {
    if (this.mode() === 'health') {
      submit(this.healthForm, async () => {
        this.healthApi
          .updateParticipantHealth(this.selected()!.id, this.healthModel())
          .subscribe((x) => {
            this.health.set(x);
            this.mode.set('detail');
          });
      });
      return;
    }
    submit(this.participantForm, async () => {
      const req =
        this.mode() === 'create'
          ? this.api.createParticipant(this.model())
          : this.api.updateParticipant(this.selected()!.id, this.model());
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
      this.api.deleteParticipant(x.id).subscribe(() => {
        this.items.update((a) => a.filter((i) => i.id !== x.id));
        this.opened.set(false);
      });
  }
}
