import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface HeroCta {
  label: string;
  link: string;
  external?: boolean;
}

/**
 * Bandeau d'introduction (hero) réutilisable pour les pages principales du site.
 * Le fond utilise un dégradé CSS (pas d'image lourde) tant que les visuels officiels
 * ne sont pas fournis, afin de rester léger et performant.
 */
@Component({
  selector: 'app-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.scss',
})
export class Hero {
  readonly eyebrow = input<string>();
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly primaryCta = input<HeroCta>();
  readonly secondaryCta = input<HeroCta>();
  readonly compact = input(false);
}
