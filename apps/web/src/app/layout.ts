import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { TuiButton, TuiIcon, TuiLink, TuiScrollbar } from '@taiga-ui/core';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from './core/auth.service';

type MenuItem = {
  label: string;
  path: string;
  icon: string;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TuiButton, TuiIcon, TuiLink, TuiScrollbar],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);

  protected readonly currentPageTitle = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.getRouteTitle()),
    ),
    { initialValue: 'Accueil' },
  );
  protected readonly isCompactMenu = signal(false);
  protected readonly isMenuExpandedByInteraction = signal(false);
  protected readonly isMobileMenuOpen = signal(false);
  protected readonly isMenuVisuallyCompact = computed(
    () => this.isCompactMenu() && !this.isMenuExpandedByInteraction(),
  );

  protected readonly navGroups: MenuGroup[] = [
    {
      label: 'Vue generale',
      items: [
        { label: 'Accueil', path: '/accueil', icon: '@tui.house' },
        { label: 'Rassemblement', path: '/rassemblement', icon: '@tui.calendar' },
      ],
    },
    {
      label: 'Inscriptions & personnes',
      items: [
        { label: 'Participants', path: '/participants', icon: '@tui.users' },
        { label: 'Benevoles', path: '/benevoles', icon: '@tui.user-check' },
        { label: "Familles d'accueil", path: '/familles', icon: '@tui.home' },
      ],
    },
    {
      label: 'Organisation & logistique',
      items: [
        { label: 'Equipes & missions', path: '/equipes-missions', icon: '@tui.briefcase' },
        { label: 'Équipes opérationnelles', path: '/equipes-operationnelles', icon: '@tui.users' },
        { label: 'Transports', path: '/transports', icon: '@tui.bus' },
        { label: 'Hebergement', path: '/hebergement', icon: '@tui.building' },
      ],
    },
    {
      label: 'Jour J & pilotage',
      items: [
        { label: 'Tableau de bord Jour J', path: '/jour-j', icon: '@tui.activity' },
        { label: 'Incidents & demandes', path: '/incidents', icon: '@tui.triangle-alert' },
        { label: 'Consignes & documents', path: '/consignes-docs', icon: '@tui.file-text' },
      ],
    },
    {
      label: 'Administration',
      items: [
        { label: 'Parametres & roles', path: '/parametres-roles', icon: '@tui.settings' },
        { label: 'Donnees & exports', path: '/donnees-exports', icon: '@tui.database' },
      ],
    },
  ];

  protected logout(): void {
    this.auth.logout();
  }

  constructor() {
    effect(() => {
      const currentPageTitle = this.currentPageTitle();

      this.titleService.setTitle(`Allegria 2027 - ${currentPageTitle}`);
      this.isMenuExpandedByInteraction.set(false);
      this.isMobileMenuOpen.set(false);
    });
  }

  protected toggleCompactMenu(): void {
    this.isCompactMenu.update((value) => !value);
    this.isMenuExpandedByInteraction.set(false);
  }

  protected toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((value) => !value);
  }

  protected closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  protected onMenuItemSelect(): void {
    this.isMenuExpandedByInteraction.set(false);
    this.closeMobileMenu();
  }

  protected onMenuMouseEnter(): void {
    if (this.isCompactMenu()) {
      this.isMenuExpandedByInteraction.set(true);
    }
  }

  protected onMenuMouseLeave(): void {
    this.isMenuExpandedByInteraction.set(false);
  }

  protected onMenuFocusIn(): void {
    if (this.isCompactMenu()) {
      this.isMenuExpandedByInteraction.set(true);
    }
  }

  protected onMenuFocusOut(event: FocusEvent): void {
    const sidebar = event.currentTarget as HTMLElement | null;
    const nextFocused = event.relatedTarget as Node | null;

    if (!sidebar || !nextFocused || !sidebar.contains(nextFocused)) {
      this.isMenuExpandedByInteraction.set(false);
    }
  }

  private getRouteTitle(): string {
    let route: ActivatedRouteSnapshot | undefined = this.router.routerState.snapshot.root;

    while (route?.firstChild) {
      route = route.firstChild;
    }

    const routeTitle = route?.title;

    return typeof routeTitle === 'string' && routeTitle.trim().length > 0 ? routeTitle : 'Accueil';
  }
}
