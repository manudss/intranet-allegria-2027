import { Component, inject, signal } from '@angular/core';
import { TuiLoader } from '@taiga-ui/core';
import { catchError, of } from 'rxjs';
import {
  ContactsContent,
  InfosContent,
  StaticContentService,
} from '../../services/static-content.service';

@Component({
  selector: 'app-infos',
  standalone: true,
  imports: [TuiLoader],
  templateUrl: './infos.html',
  styleUrl: './infos.scss',
})
export class InfosComponent {
  private readonly content = inject(StaticContentService);

  readonly infos = signal<InfosContent | null>(null);
  readonly contacts = signal<ContactsContent | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  constructor() {
    this.content
      .getInfos()
      .pipe(
        catchError(() => {
          this.failed.set(true);
          return of(null);
        }),
      )
      .subscribe((infos) => {
        this.infos.set(infos);
        this.loading.set(false);
      });
    this.content
      .getContacts()
      .pipe(catchError(() => of(null)))
      .subscribe((contacts) => this.contacts.set(contacts));
  }
}
