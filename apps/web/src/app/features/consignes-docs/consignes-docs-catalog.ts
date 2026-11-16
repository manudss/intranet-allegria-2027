import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { DocumentCategory, DocumentLink } from '../../models/models';
import { DocumentCategoriesApiService, DocumentLinksApiService } from '../../services/api.services';
import { SHARED_IMPORTS } from '../../shared/shared-imports';

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

@Component({
  selector: 'app-consignes-docs-catalog',
  standalone: true,
  imports: [...SHARED_IMPORTS, RouterLink],
  templateUrl: './consignes-docs-catalog.html',
  styleUrls: ['./consignes-docs-catalog.scss'],
})
export class ConsignesDocsCatalogPage implements OnInit {
  private readonly linksApi = inject(DocumentLinksApiService);
  private readonly categoriesApi = inject(DocumentCategoriesApiService);
  private readonly auth = inject(AuthService);

  readonly canManage = computed(() => this.auth.hasAnyRole(['ADMIN', 'COORDINATOR']));

  items = signal<DocumentLink[]>([]);
  categories = signal<DocumentCategory[]>([]);
  query = signal('');
  selectedCategoryId = signal<number | null>(null);
  loading = signal(true);

  readonly activeCategories = computed(() =>
    this.categories().filter((category) => category.isActive),
  );

  readonly filtered = computed(() => {
    const search = normalizeSearch(this.query());
    const categoryId = this.selectedCategoryId();
    return this.items().filter((link) => {
      if (categoryId !== null && link.categoryId !== categoryId) {
        return false;
      }
      if (!search) {
        return true;
      }
      const haystack = normalizeSearch(
        [link.title, link.description ?? '', link.category?.label ?? ''].join(' '),
      );
      return search.split(' ').every((token) => haystack.includes(token));
    });
  });

  ngOnInit(): void {
    this.linksApi
      .listCatalog()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: (items) => this.items.set(items) });
    this.categoriesApi.list().subscribe({ next: (categories) => this.categories.set(categories) });
  }

  selectCategory(id: number | null): void {
    this.selectedCategoryId.set(id);
  }

  openInSharePoint(link: DocumentLink): void {
    window.open(link.url, '_blank', 'noopener');
  }
}
