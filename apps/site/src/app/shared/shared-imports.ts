import { RouterLink, RouterLinkActive } from '@angular/router';
import { Hero } from './components/hero/hero';
import { InfoCard } from './components/card/info-card';
import { Accordion } from './components/accordion/accordion';
import { Steps } from './components/steps/steps';
import { AlertBanner } from './components/alert-banner/alert-banner';
import { Quote } from './components/quote/quote';
import { ProvisionalBadge } from './components/provisional-badge/provisional-badge';
import { KeyFigures } from './components/key-figures/key-figures';

/**
 * Regroupement des imports fréquemment utilisés par les pages du site public.
 * Usage : `imports: [...SHARED_IMPORTS]` dans les composants standalone de `features/`.
 */
export const SHARED_IMPORTS = [
  RouterLink,
  RouterLinkActive,
  Hero,
  InfoCard,
  Accordion,
  Steps,
  AlertBanner,
  Quote,
  ProvisionalBadge,
  KeyFigures,
] as const;
