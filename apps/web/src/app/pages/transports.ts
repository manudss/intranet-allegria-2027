import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Group } from '../models/models';
import { GroupsApiService } from '../services/api.services';
import { SHARED_IMPORTS } from '../shared/shared-imports';

/**
 * Entrée « Transports » : choix de la délégation pour gérer ses trajets
 * aller/retour, la répartition des personnes et les exceptions. Le périmètre
 * est appliqué côté serveur : un responsable ne gère que sa délégation.
 */
@Component({
  selector: 'app-transports',
  standalone: true,
  imports: [...SHARED_IMPORTS, RouterLink],
  templateUrl: './transports.html',
  styleUrl: '../shared/crud.scss',
})
export class Transports implements OnInit {
  private readonly groupsApi = inject(GroupsApiService);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly groups = signal<Group[]>([]);

  ngOnInit() {
    this.groupsApi.list().subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les délégations.');
        this.loading.set(false);
      },
    });
  }
}
