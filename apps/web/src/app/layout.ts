import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TuiButton, TuiIcon, TuiLink, TuiScrollbar } from '@taiga-ui/core';
import { filter, startWith } from 'rxjs';

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
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly titleService = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  protected currentPageTitle = 'Accueil';
  protected isCompactMenu = false;
  protected isMenuExpandedByInteraction = false;
  protected isMobileMenuOpen = false;

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

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.currentPageTitle = this.getRouteTitle();
        this.titleService.setTitle(`Allegria 2027 - ${this.currentPageTitle}`);
        this.isMenuExpandedByInteraction = false;
        this.isMobileMenuOpen = false;
      });
  }

  protected get isMenuVisuallyCompact(): boolean {
    return this.isCompactMenu && !this.isMenuExpandedByInteraction;
  }

  protected toggleCompactMenu(): void {
    this.isCompactMenu = !this.isCompactMenu;
    this.isMenuExpandedByInteraction = false;
  }

  protected toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  protected closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  protected onMenuItemSelect(): void {
    this.isMenuExpandedByInteraction = false;
    this.closeMobileMenu();
  }

  protected onMenuMouseEnter(): void {
    if (this.isCompactMenu) {
      this.isMenuExpandedByInteraction = true;
    }
  }

  protected onMenuMouseLeave(): void {
    this.isMenuExpandedByInteraction = false;
  }

  protected onMenuFocusIn(): void {
    if (this.isCompactMenu) {
      this.isMenuExpandedByInteraction = true;
    }
  }

  protected onMenuFocusOut(event: FocusEvent): void {
    const sidebar = event.currentTarget as HTMLElement | null;
    const nextFocused = event.relatedTarget as Node | null;

    if (!sidebar || !nextFocused || !sidebar.contains(nextFocused)) {
      this.isMenuExpandedByInteraction = false;
    }
  }

  private getRouteTitle(): string {
    let route = this.activatedRoute;

    while (route.firstChild) {
      route = route.firstChild;
    }

    const routeTitle = route.snapshot.title;

    return typeof routeTitle === 'string' && routeTitle.trim().length > 0 ? routeTitle : 'Accueil';
  }
}
