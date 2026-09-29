import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SeoMeta } from '../models/content.models';

const SITE_NAME = 'Alegria 2027 — MEJ';
const DEFAULT_OG_IMAGE = '/images/og/alegria-2027-default.jpg';
const SITE_URL = 'https://alegria2027.mej.fr';

/**
 * Service centralisant la gestion des métadonnées SEO (title, description, Open Graph).
 * À appeler dans `ngOnInit` de chaque page via `seoService.apply(meta)`.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);

  apply(meta: SeoMeta): void {
    const fullTitle = `${meta.title} · ${SITE_NAME}`;
    this.titleService.setTitle(fullTitle);

    this.setTag('description', meta.description);
    this.setTag('og:title', fullTitle, 'property');
    this.setTag('og:description', meta.description, 'property');
    this.setTag('og:type', 'website', 'property');
    this.setTag('og:image', meta.ogImage ?? DEFAULT_OG_IMAGE, 'property');
    this.setTag('twitter:card', 'summary_large_image');
    this.setTag('twitter:title', fullTitle);
    this.setTag('twitter:description', meta.description);

    if (meta.noIndex) {
      this.setTag('robots', 'noindex, nofollow');
    } else {
      this.setTag('robots', 'index, follow');
    }

    if (meta.canonicalPath) {
      this.setCanonical(`${SITE_URL}${meta.canonicalPath}`);
    }
  }

  private setTag(name: string, content: string, attribute: 'name' | 'property' = 'name'): void {
    this.metaService.updateTag({ [attribute]: name, content });
  }

  private setCanonical(url: string): void {
    let link: HTMLLinkElement | null = this.document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
