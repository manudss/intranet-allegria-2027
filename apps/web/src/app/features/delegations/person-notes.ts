import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import {
  DelegationsApiService,
  NoteFeedRow,
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
  styleUrl: '../../shared/crud.scss',
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
  protected readonly roots = computed(() => this.notes().filter((n) => !n.parent));
  protected readonly newNote = signal('');
  protected readonly replyDrafts = signal<Record<number, string>>({});

  private personType: PersonType = 'PARTICIPANT';
  private personId = 0;

  ngOnInit() {
    const type = this.route.snapshot.paramMap.get('personType');
    const id = this.route.snapshot.paramMap.get('personId');
    if (type && id) {
      this.personMode.set(true);
      this.personType = type as PersonType;
      this.personId = Number(id);
      this.reloadPerson();
    } else {
      this.reloadFeed();
    }
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
