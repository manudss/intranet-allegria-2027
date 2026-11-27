import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SHARED_IMPORTS } from '../../../shared/shared-imports';
import { Group } from '../../../models/models';
import { GroupsApiService } from '../../../services/api.services';
import {
  DelegationSummary,
  DelegationsApiService,
  NoteFeedRow,
  PersonLite,
  Repartition,
} from '../delegations-api.service';

type FicheView = 'ensemble' | 'personnes' | 'sous-delegations' | 'exceptions' | 'notes';
type PersonFilter = 'TOUT' | 'JEUNE' | 'ANIMATEUR' | 'BENEVOLE';

/**
 * Fiche délégation en plusieurs vues (lot 4 de la refonte) : vue d'ensemble
 * (identité, effectifs, responsables), Personnes (sans santé), Sous-délégations
 * (aller et retour côte à côte, jauges), Exceptions (reçues et sortantes) et
 * Notes. Le périmètre est appliqué côté serveur : un responsable ne voit que sa
 * délégation.
 */
@Component({
  selector: 'app-delegation-fiche-page',
  standalone: true,
  imports: [...SHARED_IMPORTS, RouterLink],
  templateUrl: './delegation-fiche.page.html',
  styleUrls: ['../../../shared/crud.scss', './delegation-fiche.page.scss'],
})
export class DelegationFichePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(DelegationsApiService);
  private readonly groupsApi = inject(GroupsApiService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly view = signal<FicheView>('ensemble');

  protected delegationId = 0;
  protected readonly group = signal<Group | null>(null);
  protected readonly summary = signal<DelegationSummary | null>(null);
  protected readonly persons = signal<PersonLite[]>([]);
  protected readonly aller = signal<Repartition | null>(null);
  protected readonly retour = signal<Repartition | null>(null);
  protected readonly noteRows = signal<NoteFeedRow[]>([]);
  protected readonly delegationNames = signal<Map<number, string>>(new Map());

  protected readonly personFilter = signal<PersonFilter>('TOUT');

  ngOnInit() {
    this.delegationId = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    forkJoin({
      group: this.groupsApi.get(this.delegationId),
      summaries: this.api.listSummaries(),
      persons: this.api.persons(this.delegationId),
      aller: this.api.repartition(this.delegationId, 'ALLER'),
      retour: this.api.repartition(this.delegationId, 'RETOUR'),
      notes: this.api.notesFeed('ALL'),
    }).subscribe({
      next: (r) => {
        this.group.set(r.group);
        this.summary.set(r.summaries.find((s) => s.id === this.delegationId) ?? null);
        this.delegationNames.set(new Map(r.summaries.map((s) => [s.id, s.name])));
        this.persons.set(r.persons);
        this.aller.set(r.aller);
        this.retour.set(r.retour);
        this.noteRows.set(r.notes.filter((n) => n.delegationId === this.delegationId));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Le chargement de la délégation a échoué.');
      },
    });
  }

  protected setView(v: FicheView) {
    this.view.set(v);
  }

  protected jeunes() {
    return this.persons().filter((p) => p.personType === 'PARTICIPANT' && p.detail === 'JEUNE');
  }
  protected animateurs() {
    return this.persons().filter((p) => p.personType === 'PARTICIPANT' && p.detail === 'ANIMATEUR');
  }
  protected benevoles() {
    return this.persons().filter(
      (p) => p.personType === 'VOLUNTEER' || (p.personType === 'PARTICIPANT' && p.detail === 'BENEVOLE'),
    );
  }

  protected readonly filteredPersons = computed(() => {
    const f = this.personFilter();
    if (f === 'JEUNE') return this.jeunes();
    if (f === 'ANIMATEUR') return this.animateurs();
    if (f === 'BENEVOLE') return this.benevoles();
    return this.persons();
  });

  protected personLabel(p: PersonLite) {
    return p.personType === 'VOLUNTEER' ? 'Bénévole' : 'Jeune';
  }

  protected delegationName(id: number | null | undefined) {
    if (id == null) return '';
    return this.delegationNames().get(id) ?? `Délégation ${id}`;
  }

  protected pct(rep: Repartition | null): number {
    if (!rep) return 100;
    const capacity = rep.transports.reduce((acc, t) => acc + (t.capacity ?? 0), 0);
    if (capacity === 0) return rep.toAssign.length === 0 ? 100 : 0;
    const placed = rep.transports.reduce((acc, t) => acc + t.occupancy, 0);
    const total = placed + rep.toAssign.length;
    if (total === 0) return 100;
    return Math.round((100 * placed) / total);
  }

  protected transportPct(occupancy: number, capacity: number | null): number {
    if (!capacity) return 0;
    return Math.min(100, Math.round((100 * occupancy) / capacity));
  }

  protected formatDateTime(value: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return (
      d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) +
      ' ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    );
  }
}
