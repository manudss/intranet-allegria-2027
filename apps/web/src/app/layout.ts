import { Component, ElementRef, TemplateRef, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import {
  ActivatedRouteSnapshot,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { TuiButton, TuiDialogService, TuiIcon } from '@taiga-ui/core';
import { GLOSSARY, tourFor } from './shared/help-content';
import { filter, finalize, map, startWith } from 'rxjs';
import { AuthService } from './core/auth.service';
import { AppearanceToggleComponent } from './shared/appearance-toggle.component';
import { LoadingSkeletonComponent } from './shared/loading-skeleton.component';
import { PAGE_HELP } from './shared/page-help';
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
    AppearanceToggleComponent,
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
    LoadingSkeletonComponent,
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

  /** Vrai entre le début d'une navigation et l'affichage de la page : on montre alors un squelette. */
  protected readonly navigating = toSignal(
    this.router.events.pipe(
      filter(
        (event) =>
          event instanceof NavigationStart ||
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError,
      ),
      map((event) => event instanceof NavigationStart),
    ),
    { initialValue: false },
  );

  /** Phrase « À quoi sert cette page » pour les pages qui n'ont pas leur propre en-tête. */
  protected readonly shellPurpose = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        const help = PAGE_HELP[this.getRoutePath()];
        return help?.shell ? help.purpose : '';
      }),
    ),
    { initialValue: '' },
  );

  protected readonly expanded = signal(true);
  protected readonly isMobileMenuOpen = signal(false);

  private readonly dialogs = inject(TuiDialogService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly helpTemplate = viewChild.required<TemplateRef<unknown>>('helpDialog');
  protected readonly glossary = GLOSSARY;
  protected readonly helpStep = signal(0);
  protected get helpTour() {
    return tourFor(this.auth.currentUser()?.roles ?? []);
  }

  /** Ouvre l'aide : visite guidée de 3 étapes (relançable) et glossaire. */
  protected openHelp(): void {
    this.helpStep.set(0);
    // La boîte est rendue hors de la coque de l'application : on rend la coque inerte
    // tant qu'elle est ouverte (ni focus, ni lecture du fond). La boîte elle-même ne l'est pas.
    const shell = this.host.nativeElement.querySelector<HTMLElement>('.allegria-shell');
    shell?.setAttribute('inert', '');
    this.dialogs
      .open(this.helpTemplate(), { label: 'Aide', size: 'm' })
      .pipe(finalize(() => shell?.removeAttribute('inert')))
      .subscribe();
  }

  protected readonly navGroups: MenuGroup[] = [
    {
      label: 'Vue générale',
      icon: '@tui.layout-dashboard',
      items: [
        { label: 'Accueil', path: '/accueil', icon: '@tui.house' },
        { label: 'Rassemblement', path: '/rassemblement', icon: '@tui.calendar' },
        { label: 'Glossaire', path: '/glossaire', icon: '@tui.book-open' },
      ],
    },
    {
      label: 'Inscriptions et personnes',
      icon: '@tui.users',
      items: [
        { label: 'Participants', path: '/participants', icon: '@tui.users' },
        {label:'Dossiers sanitaires',path:'/dossiers-sanitaires',icon:'@tui.heart-pulse'},
        { label: 'Inscriptions familles', path: '/inscriptions-familles', icon: '@tui.clipboard-list' },
        { label: 'Équipes de rassemblement', path: '/equipes', icon: '@tui.users-round' },
        { label: 'Répartition jeunes', path: '/equipes/repartition', icon: '@tui.shuffle' },
        { label: "Familles d'accueil", path: '/familles', icon: '@tui.home' },
        { label: 'Bénévoles', path: '/benevoles', icon: '@tui.user-check' },
        { label: 'Répartition bénévoles', path: '/benevoles/repartition', icon: '@tui.users-round' },
      ],
    },
    {
      label: 'Organisation et logistique',
      icon: '@tui.briefcase-business',
      items: [
        { label: 'Équipes opérationnelles', path: '/equipes-operationnelles', icon: '@tui.users' },
        { label: 'Missions bénévoles', path: '/missions-benevoles', icon: '@tui.clipboard-list' },
        { label: 'Transports', path: '/transports', icon: '@tui.bus' },
        { label: 'Restauration : besoins', path: '/restauration-besoins', icon: '@tui.utensils' },
        { label: 'Hébergement', path: '/hebergement', icon: '@tui.building' },
      ],
    },
    {
      label: 'Jour J et pilotage',
      icon: '@tui.activity',
      items: [
        { label: 'Agenda et ordonnancement', path: '/programme', icon: '@tui.calendar-clock' },
        { label: 'Suivi des accès', path: '/acces/suivi', icon: '@tui.scan-line' },
        { label: 'Tableau de bord Jour J', path: '/jour-j', icon: '@tui.activity' },
        { label: 'Incidents et demandes', path: '/incidents', icon: '@tui.triangle-alert' },
        { label: 'Consignes et documents', path: '/consignes-docs', icon: '@tui.file-text' },
      ],
    },
    {
      label: "Contrôle d'accès",
      icon: '@tui.scan-line',
      items: [
        {label:'Badges et impression',path:'/acces/impression',icon:'@tui.printer'},
        { label: 'Stock des badges', path: '/acces/badges', icon: '@tui.credit-card' },
        { label: 'Attribution et remplacement', path: '/acces/attribution', icon: '@tui.repeat' },
        { label: 'Autorisations de scan', path: '/acces/habilitations', icon: '@tui.shield-check' },
        { label: 'Configuration du contrôle', path: '/acces/configuration', icon: '@tui.settings' },
        { label: 'Journal des accès', path: '/acces/journal', icon: '@tui.file-text' },
      ],
    },
    {
      label: 'Administration',
      icon: '@tui.settings',
      items: [
        { label: 'Paramètres et rôles', path: '/parametres-roles', icon: '@tui.settings' },
        { label: 'Journal bénévoles', path: '/journal-benevoles', icon: '@tui.file-text' },
        { label: 'Données et exports', path: '/donnees-exports', icon: '@tui.database' },
      ],
    },
  ];

  protected logout(): void {
    this.auth.logout();
  }

  constructor() {
    effect(() => {
      const currentPageTitle = this.currentPageTitle();

      this.titleService.setTitle(`Alegria 2027 - ${currentPageTitle}`);
      this.isMobileMenuOpen.set(false);
    });
  }

  protected handleToggle(): void {
    this.expanded.update((value) => !value);
  }

  protected focusContent(event: Event): void {
    event.preventDefault();
    document.getElementById('contenu')?.focus();
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

  private getRoutePath(): string {
    let route: ActivatedRouteSnapshot | undefined = this.router.routerState.snapshot.root;

    while (route?.firstChild) {
      route = route.firstChild;
    }

    return route?.routeConfig?.path ?? '';
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
