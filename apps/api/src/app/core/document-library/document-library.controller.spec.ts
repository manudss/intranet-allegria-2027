import { describe, expect, it, vi } from 'vitest';
import { DocumentLinkVisibility } from '../entities';
import { DocumentLibraryController } from './document-library.controller';
import { DocumentLibraryService } from './document-library.service';

const adminReq = { user: { id: 1, email: 'admin@test.com', roles: ['ADMIN'] } };

describe('DocumentLibraryController', () => {
  it('délègue la liste des fiches visibles au service avec l utilisateur connecté', async () => {
    const links = [{ id: 1 }];
    const service = {
      listVisibleLinks: vi.fn().mockResolvedValue(links),
    } as unknown as DocumentLibraryService;
    const controller = new DocumentLibraryController(service);

    await expect(controller.listLinks(adminReq, { search: 'guide' })).resolves.toEqual(links);
    expect(service.listVisibleLinks).toHaveBeenCalledWith(adminReq.user, { search: 'guide' });
  });

  it('délègue la création d une fiche au service', async () => {
    const link = { id: 7 };
    const service = {
      createLink: vi.fn().mockResolvedValue(link),
    } as unknown as DocumentLibraryService;
    const controller = new DocumentLibraryController(service);
    const dto = {
      title: 'Guide ES animateurs',
      url: 'https://mej.sharepoint.com/sites/allegria/guide.pdf',
      visibility: DocumentLinkVisibility.ALL,
    };

    await expect(controller.createLink(adminReq, dto)).resolves.toEqual(link);
    expect(service.createLink).toHaveBeenCalledWith(adminReq.user, dto);
  });

  it('délègue la gestion des catégories au service', async () => {
    const category = { id: 3, code: 'TA' };
    const service = {
      createCategory: vi.fn().mockResolvedValue(category),
      listCategories: vi.fn().mockResolvedValue([category]),
    } as unknown as DocumentLibraryService;
    const controller = new DocumentLibraryController(service);

    await expect(controller.createCategory({ code: 'TA', label: 'TA' })).resolves.toEqual(category);
    await expect(controller.listCategories()).resolves.toEqual([category]);
  });
});
