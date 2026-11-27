import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';

export type AccessLevelCode = 'VIEW' | 'EDIT' | 'MANAGE';

interface MyGrant {
  module: string;
  level: AccessLevelCode;
  scope: string;
}

const RANK: Record<AccessLevelCode, number> = { VIEW: 1, EDIT: 2, MANAGE: 3 };

/**
 * Droits effectifs du compte connecté (GET /api/access/me), pour n'afficher un lien de
 * modification que si le compte peut l'utiliser. Le serveur reste seul juge : ce service
 * ne sert qu'à ne pas proposer un lien voué au refus.
 */
@Injectable({ providedIn: 'root' })
export class MyAccessService {
  private readonly http = inject(HttpClient);
  private readonly grants = signal<MyGrant[] | null>(null);
  readonly loaded = computed(() => this.grants() !== null);
  private requested = false;

  /** Charge les droits une seule fois. */
  load(): void {
    if (this.requested) return;
    this.requested = true;
    this.http
      .get<{ grants: MyGrant[] }>('/api/access/me')
      // En cas d'échec (démarrage à froid de l'API), on laisse les droits
      // « non chargés » plutôt que « aucun droit » : un coordinateur ne doit
      // pas voir le bandeau « périmètre limité » à cause d'une erreur réseau.
      .pipe(catchError(() => of(null)))
      .subscribe((me) => {
        if (me) this.grants.set(me.grants ?? []);
      });
  }

  /** Vrai si le compte a au moins ce niveau sur le module (toute portée). */
  can(module: string, level: AccessLevelCode): boolean {
    const grant = (this.grants() ?? []).find((g) => g.module === module);
    return !!grant && RANK[grant.level] >= RANK[level];
  }

  /** Portée du droit le plus large sur le module (ALL, GROUPS, OWN_TEAM, SELF). */
  scopeOf(module: string): string | null {
    return (this.grants() ?? []).find((g) => g.module === module)?.scope ?? null;
  }
}
