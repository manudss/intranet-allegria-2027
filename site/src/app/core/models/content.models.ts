/**
 * Modèles éditoriaux centralisés pour le site public Alegria 2027.
 * Toute donnée susceptible de changer (textes, statuts, liens) doit transiter par ces types
 * afin de rester facilement modifiable sans toucher aux composants.
 */

/** Statut éditorial d'une information : permet de ne jamais présenter une donnée comme définitive. */
export type ContentStatus = 'draft' | 'confirmed';

export interface RegistrationLinks {
  youngPeople: string;
  volunteers: string;
}

export interface ContactInfo {
  general: string;
  families: string;
  volunteers: string;
}

export interface SocialLink {
  label: string;
  url: string;
  icon: string;
}

export interface EventConfig {
  name: string;
  edition: string;
  theme: { label: string; status: ContentStatus };
  dates: { start: string; end: string; label: string };
  location: {
    name: string;
    address: string;
    postalCode: string;
    city: string;
    country: string;
    mapUrl: string;
  };
  registrationLinks: RegistrationLinks;
  contacts: ContactInfo;
  socialLinks: SocialLink[];
}

/** Méta-données SEO associées à une page. */
export interface SeoMeta {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
  noIndex?: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqCategory {
  id: string;
  label: string;
  items: FaqItem[];
}

export type ProgramBlockType =
  'collectif' | 'atelier' | 'spirituel' | 'repas' | 'libre' | 'pratique';

export interface ProgramBlock {
  type: ProgramBlockType;
  label: string;
  description?: string;
}

export interface ProgramDay {
  id: string;
  date: string;
  weekday: string;
  title: string;
  intention: string;
  status: ContentStatus;
  blocks: ProgramBlock[];
}

export interface VolunteerMission {
  id: string;
  label: string;
  description: string;
  status: ContentStatus;
}

export type ParticipationProfileId =
  'jeune' | 'famille' | 'animateur' | 'benevole' | 'responsable' | 'decouverte';

export interface ParticipationProfile {
  id: ParticipationProfileId;
  title: string;
  description: string;
  ctaLabel: string;
  ctaLink: string;
  externalCta?: boolean;
}

export interface JourneyStep {
  title: string;
  description: string;
}

export interface KeyFigure {
  value: string;
  label: string;
}

export interface QuoteContent {
  text: string;
  attribution?: string;
}

export interface NewsItem {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  status: ContentStatus;
}
