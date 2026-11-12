import { Component, effect, inject, signal } from '@angular/core';
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
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from './core/auth.service';
import { TuiNavigation } from '@taiga-ui/layout';
import { NgTemplateOutlet } from "@angular/common";
import { TuiAvatar, TuiChevron, TuiFade } from "@taiga-ui/kit";

type MenuItem = {
  label: string;
  path: string;
  icon: string;
};

type MenuGroup = {
  label: string;
  icon: string;
  items: MenuItem[];
};

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TuiButton,
    TuiIcon,
    TuiNavigation,
    TuiChevron,
    TuiFade,
    TuiAvatar,
  ],
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

  protected readonly expanded = signal(true);
  protected readonly isMobileMenuOpen = signal(false);

  protected readonly navGroups: MenuGroup[] = [
    {
      label: 'Vue generale',
      icon: '@tui.layout-dashboard',
      items: [
        { label: 'Accueil', path: '/accueil', icon: '@tui.house' },
        { label: 'Rassemblement', path: '/rassemblement', icon: '@tui.calendar' },
      ],
    },
    {
      label: 'Inscriptions & personnes',
      icon: '@tui.users',
      items: [
        { label: 'Participants', path: '/participants', icon: '@tui.users' },
        { label: 'Équipes rassemblement', path: '/equipes', icon: '@tui.users-round' },
        { label: 'Répartition jeunes', path: '/equipes/repartition', icon: '@tui.shuffle' },
        { label: "Familles d'accueil", path: '/familles', icon: '@tui.home' },
        { label: 'Bénévoles', path: '/benevoles', icon: '@tui.user-check' },
        { label: 'Répartition bénévoles', path: '/benevoles/repartition', icon: '@tui.users-round' },
      ],
    },
    {
      label: 'Organisation & logistique',
      icon: '@tui.briefcase-business',
      items: [
        { label: 'Équipes opérationnelles', path: '/equipes-operationnelles', icon: '@tui.users' },
        { label: 'Missions bénévoles', path: '/missions-benevoles', icon: '@tui.clipboard-list' },
        { label: 'Transports', path: '/transports', icon: '@tui.bus' },
        { label: 'Hébergement', path: '/hebergement', icon: '@tui.building' },
      ],
    },
    {
      label: 'Jour J & pilotage',
      icon: '@tui.activity',
      items: [
        { label: 'Agenda & Ordonnancement', path: '/programme', icon: '@tui.calendar-clock' },
        { label: 'Tableau de bord Jour J', path: '/jour-j', icon: '@tui.activity' },
        { label: 'Incidents & demandes', path: '/incidents', icon: '@tui.triangle-alert' },
        { label: 'Consignes & documents', path: '/consignes-docs', icon: '@tui.file-text' },
      ],
    },
    {
      label: 'Administration',
      icon: '@tui.settings',
      items: [
        { label: 'Paramètres & rôles', path: '/parametres-roles', icon: '@tui.settings' },
        { label: 'Journal bénévoles', path: '/journal-benevoles', icon: '@tui.file-text' },
        { label: 'Données & exports', path: '/donnees-exports', icon: '@tui.database' },
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
      this.isMobileMenuOpen.set(false);
    });
  }

  protected handleToggle(): void {
    this.expanded.update((value) => !value);
  }

  protected toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((value) => !value);
  }

  protected closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  protected onMenuItemSelect(): void {
    this.closeMobileMenu();
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
