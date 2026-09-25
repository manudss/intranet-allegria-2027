import { EventConfig } from '../models/content.models';

/**
 * Configuration éditoriale centralisée de l'événement Alegria 2027.
 *
 * ⚠️ PLACEHOLDERS À REMPLACER PAR L'ÉQUIPE D'ORGANISATION :
 * - `registrationLinks.*` : URLs vers les formulaires/portails d'inscription réels.
 * - `contacts.*` : adresses e-mail officielles.
 * - `theme.label` : thème officiel 2027 (non communiqué à ce jour).
 * - `socialLinks` : à compléter une fois les comptes officiels confirmés.
 */
export const eventConfig: EventConfig = {
  name: 'Alegria 2027',
  edition: 'Rassemblement national du MEJ',
  theme: {
    label: 'Thème à venir',
    status: 'draft',
  },
  dates: {
    start: '2027-10-30',
    end: '2027-11-02',
    label: 'Du samedi 30 octobre au mardi 2 novembre 2027',
  },
  location: {
    name: 'Centre de Congrès de Saint-Étienne',
    address: '23 rue Pierre et Dominique Ponchardier',
    postalCode: '42000',
    city: 'Saint-Étienne',
    country: 'France',
    mapUrl:
      'https://www.openstreetmap.org/search?query=23%20rue%20Pierre%20et%20Dominique%20Ponchardier%2C%2042000%20Saint-%C3%89tienne',
  },
  registrationLinks: {
    // TODO(organisation): remplacer par l'URL réelle du formulaire d'inscription jeunes.
    youngPeople: '',
    // TODO(organisation): remplacer par l'URL réelle du formulaire d'inscription familles.
    families: '',
    // TODO(organisation): remplacer par l'URL réelle du formulaire d'inscription bénévoles.
    volunteers: '',
  },
  contacts: {
    // TODO(organisation): renseigner l'adresse e-mail de contact général.
    general: '',
    // TODO(organisation): renseigner l'adresse e-mail dédiée aux familles.
    families: '',
    // TODO(organisation): renseigner l'adresse e-mail dédiée aux bénévoles.
    volunteers: '',
  },
  socialLinks: [
    // TODO(organisation): ajouter les réseaux sociaux officiels une fois confirmés.
  ],
};

/**
 * Résout un lien d'inscription : si le lien réel n'est pas encore configuré,
 * renvoie `undefined` afin que les composants puissent désactiver ou masquer le bouton
 * plutôt que de pointer vers une URL vide.
 */
export function resolveRegistrationLink(link: string): string | undefined {
  return link && link.trim().length > 0 ? link : undefined;
}
