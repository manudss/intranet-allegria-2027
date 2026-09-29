import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { FaqItem } from '../../../core/models/content.models';

/**
 * Accordéon accessible (WAI-ARIA) pour afficher une liste de questions/réponses.
 * - Navigation clavier native (les `<button>` gèrent Tab/Entrée/Espace).
 * - `aria-expanded` sur le déclencheur, association `aria-controls` / `id`.
 * - Chaque question possède un ancre stable permettant le partage via fragment d'URL
 *   (`/faq#<idPrefix>-<item.id>`).
 */
@Component({
  selector: 'app-accordion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accordion.html',
  styleUrl: './accordion.scss',
})
export class Accordion {
  readonly items = input.required<FaqItem[]>();
  readonly idPrefix = input('faq');
  readonly initialOpenId = input<string>();

  private readonly openIds = signal<ReadonlySet<string>>(new Set());

  isOpen(id: string): boolean {
    const initial = this.initialOpenId();
    if (this.openIds().has(id)) {
      return true;
    }
    return !this.openIds().has(`closed:${id}`) && initial === this.anchorId(id);
  }

  toggle(id: string): void {
    const current = new Set(this.openIds());
    const wasOpenByDefault = this.initialOpenId() === this.anchorId(id) && !current.has(`closed:${id}`);
    const isCurrentlyOpen = current.has(id) || wasOpenByDefault;

    if (isCurrentlyOpen) {
      current.delete(id);
      current.add(`closed:${id}`);
    } else {
      current.delete(`closed:${id}`);
      current.add(id);
    }
    this.openIds.set(current);
  }

  anchorId(id: string): string {
    return `${this.idPrefix()}-${id}`;
  }

  panelId(id: string): string {
    return `${this.idPrefix()}-panel-${id}`;
  }
}
