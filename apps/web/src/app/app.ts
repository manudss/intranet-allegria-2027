import { AppearanceTaigaControl } from '@mej-allegria/appearance/taiga';
import { AppearanceService } from '@mej-allegria/appearance';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, Router, RouterOutlet } from '@angular/router';
import { TuiRoot } from '@taiga-ui/core';
import { filter, map } from 'rxjs';
import { LoadingSkeletonComponent } from './shared/loading-skeleton.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TuiRoot, AppearanceTaigaControl, LoadingSkeletonComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly appearance = inject(AppearanceService);
  private readonly router = inject(Router);

  /** Vrai jusqu'à la fin de la première navigation (connexion, droits) : on montre un squelette au lieu d'un écran vide. */
  protected readonly booting = toSignal(
    this.router.events.pipe(
      filter(
        (event) =>
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError,
      ),
      map(() => false),
    ),
    { initialValue: true },
  );
}
