import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { MyAccessService } from '../../core/my-access.service';
import {
  DelegationsApiService,
  NoteFeedRow,
  PersonLite,
  PersonNote,
  PersonType,
} from './delegations-api.service';

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return (
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );
}

/**
 * Page de suivi des notes logistiques : filtre avec notes / sans réponse /
 * toutes, recherche, fil par personne avec réponses et nouvelle note.
 * Les notes sont signées et datées, purement logistiques (jamais de santé),
 * et limitées au périmètre du lecteur.
 */
@Component({
  selector: 'app-person-notes',
  standalone: true,
  imports: [...SHARED_IMPORTS, RouterLink],
  templateUrl: './person-notes.html',
  styleUrls: ['../../shared/crud.scss', './person-notes.scss'],
})
export class PersonNotesPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(DelegationsApiService);

  protected readonly fmt = formatDateTime;
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly filter = signal<'WITH_NOTES' | 'UNANSWERED' | 'ALL'>('WITH_NOTES');
  protected readonly query = signal('');
  protected readonly feed = signal<NoteFeedRow[]>([]);

  /** Mode fiche personne (route person-notes/:personType/:personId). */
  protected readonly personMode = signal(false);
  protected readonly personLabel = signal('');
  protected readonly notes = signal<PersonNote[]>([]);
  protected readonly selected = signal<PersonLite | null>(null);
  protected readonly delegationNames = signal<Map<number, string>>(new Map());
  private readonly access = inject(MyAccessService);

  /** Bandeau de périmètre : un responsable ne voit que sa délégation. */
  protected readonly scopedView = computed(() => {
    if (!this.access.loaded()) return false;
    return !this.access.can('TRANSPORT', 'VIEW') || this.access.scopeOf('TRANSPORT') !== 'ALL';
  });
  protected readonly roots = computed(() => this.notes().filter((n) => !n.parent));
  protected readonly newNote = signal('');
  protected readonly replyDrafts = signal<Record<number, string>>({});

  private personType: PersonType = 'PARTICIPANT';
  private personId = 0;

  ngOnInit() {
    const type = this.route.snapshot.paramMap.get('personType');
    const id = this.route.snapshot.paramMap.get('personId');
    this.access.load();
    if (type && id) {
      this.personMode.set(true);
      this.personType = type as PersonType;
      this.personId = Number(id);
      this.reloadPerson();
    } else {
      this.api.listSummaries().subscribe({
        next: (s) => this.delegationNames.set(new Map(s.map((d) => [d.id, d.name]))),
        error: () => undefined,
      });
      this.reloadFeed();
    }
  }

  protected personRoleLabel(p: PersonLite) {
    if (p.personType === 'VOLUNTEER') return 'Bénévole';
    if (p.detail === 'ANIMATEUR') return 'Animateur';
    if (p.detail === 'JEUNE') return 'Jeune';
    if (p.detail === 'BENEVOLE') return 'Bénévole';
    return 'Participant';
  }

  protected detailSuffix(p: PersonLite) {
    if (!p.detail || ['JEUNE', 'ANIMATEUR', 'BENEVOLE'].includes(p.detail)) return '';
    return ' · ' + p.detail;
  }

  protected delegationName(id: number) {
    return this.delegationNames().get(id) ?? '';
  }

  /** Ouvre le fil de la personne dans la colonne de droite (sans changer de page). */
  protected selectRow(row: NoteFeedRow) {
    if (!row.person) return;
    this.selected.set(row.person);
    this.personType = row.person.personType;
    this.personId = row.person.id;
    this.reloadPerson();
  }

  protected backToList() {
    this.selected.set(null);
  }

  protected setFilter(f: 'WITH_NOTES' | 'UNANSWERED' | 'ALL') {
    this.filter.set(f);
    this.reloadFeed();
  }

  protected search(value: string) {
    this.query.set(value);
    this.reloadFeed();
  }

  private reloadFeed() {
    this.loading.set(true);
    this.error.set('');
    this.api.notesFeed(this.filter(), this.query()).subscribe({
      next: (rows) => {
        this.feed.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger le suivi des notes.');
        this.loading.set(false);
      },
    });
  }

  private reloadPerson() {
    this.loading.set(true);
    this.error.set('');
    this.api.personNotes(this.personType, this.personId).subscribe({
      next: (notes) => {
        this.notes.set(notes);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          'Impossible de charger les notes de cette personne (hors de votre périmètre ?).',
        );
        this.loading.set(false);
      },
    });
  }

  protected repliesOf(rootId: number) {
    return this.notes().filter((n) => n.parent?.id === rootId);
  }

  protected addNote() {
    const body = this.newNote().trim();
    if (!body) return;
    this.api.createNote(this.personType, this.personId, body).subscribe({
      next: () => {
        this.newNote.set('');
        this.reloadPerson();
      },
      error: () => this.error.set('La note n’a pas pu être enregistrée.'),
    });
  }

  protected reply(noteId: number) {
    const body = (this.replyDrafts()[noteId] || '').trim();
    if (!body) return;
    this.api.replyToNote(noteId, body).subscribe({
      next: () => {
        this.replyDrafts.update((m) => ({ ...m, [noteId]: '' }));
        this.reloadPerson();
      },
      error: () => this.error.set('La réponse n’a pas pu être enregistrée.'),
    });
  }

  protected setReply(noteId: number, value: string) {
    this.replyDrafts.update((m) => ({ ...m, [noteId]: value }));
  }
}
