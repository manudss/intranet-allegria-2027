import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavLink {
  label: string;
  path: string;
}

const NAV_LINKS: NavLink[] = [
  { label: 'Accueil', path: '/' },
  { label: 'L’événement', path: '/evenement' },
  { label: 'Programme', path: '/programme' },
  { label: 'Participer', path: '/participer' },
  { label: 'Familles d’accueil', path: '/inscription/familles' },
  { label: 'Bénévoles', path: '/benevoles' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Contact', path: '/contact' },
];

/**
 * En-tête du site avec navigation principale, menu mobile accessible et bouton
 * d'inscription ouvrant un menu d'orientation (jeune / famille / bénévole).
 */
@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly navLinks = NAV_LINKS;
  protected readonly menuOpen = signal(false);
  protected readonly registerMenuOpen = signal(false);

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
    if (this.menuOpen()) {
      this.registerMenuOpen.set(false);
    }
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleRegisterMenu(): void {
    this.registerMenuOpen.update((open) => !open);
  }

  closeRegisterMenu(): void {
    this.registerMenuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
    this.closeRegisterMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeRegisterMenu();
    }
  }
}
