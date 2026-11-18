import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DocumentFileType, DocumentLinkVisibility } from '../entities';
import {
  DocumentLibraryService,
  isMembershipActiveForDocumentAccess,
  normalizeSearchText,
  parisToday,
} from './document-library.service';

const makeService = (overrides: {
  linksRepository?: object;
  linkTeamsRepository?: object;
  categoriesRepository?: object;
  volunteersRepository?: object;
  teamsRepository?: object;
  membershipsRepository?: object;
}) =>
  new DocumentLibraryService(
    (overrides.linksRepository ?? {}) as never,
    (overrides.linkTeamsRepository ?? {}) as never,
    (overrides.categoriesRepository ?? {}) as never,
    (overrides.volunteersRepository ?? {}) as never,
    (overrides.teamsRepository ?? {}) as never,
    (overrides.membershipsRepository ?? {}) as never,
  );

const adminUser = { id: 1, email: 'admin@test.com', roles: ['ADMIN'] };
const coordinatorUser = { id: 2, email: 'coord@test.com', roles: ['COORDINATOR'] };
const viewerUser = { id: 3, email: 'viewer@test.com', roles: ['VIEWER'] };
const plainUser = { id: 4, email: 'user@test.com', roles: [] };

const makeLink = (partial: Record<string, unknown>) => ({
  id: 1,
  title: 'Guide ES animateurs',
  description: null,
  url: 'https://mej.sharepoint.com/sites/allegria/guide.pdf',
  fileType: DocumentFileType.PDF,
  visibility: DocumentLinkVisibility.ALL,
  categoryId: null,
  category: null,
  teamRestrictions: [],
  createdByUserId: 1,
  updatedByUserId: 1,
  createdAt: new Date('2026-11-16T10:00:00Z'),
  updatedAt: new Date('2026-11-16T10:00:00Z'),
  ...partial,
});

describe('parisToday', () => {
  it('renvoie la date du jour au format YYYY-MM-DD, heure de Paris', () => {
    // 16 novembre 2026, 00h30 UTC => 01h30 à Paris, même jour
    expect(parisToday(new Date('2026-11-16T00:30:00Z'))).toBe('2026-11-16');
    // 16 novembre 2026, 23h30 UTC => 17 novembre à Paris (CET, UTC+1)
    expect(parisToday(new Date('2026-11-16T23:30:00Z'))).toBe('2026-11-17');
  });
});

describe('isMembershipActiveForDocumentAccess — règle confirmée par Emmanuel le 2026-11-16', () => {
  it('donne accès sans date de fin', () => {
    expect(isMembershipActiveForDocumentAccess({ startAt: null, endAt: null }, '2026-11-16')).toBe(
      true,
    );
  });

  it('inclut le jour de la date de fin (inclusive au jour, heure de Paris)', () => {
    expect(
      isMembershipActiveForDocumentAccess({ startAt: null, endAt: '2026-11-16' }, '2026-11-16'),
    ).toBe(true);
    expect(
      isMembershipActiveForDocumentAccess({ startAt: null, endAt: '2026-11-15' }, '2026-11-16'),
    ).toBe(false);
  });

  it('ignore la date de début, même future', () => {
    expect(
      isMembershipActiveForDocumentAccess({ startAt: '2027-06-01', endAt: null }, '2026-11-16'),
    ).toBe(true);
  });
});

describe('normalizeSearchText', () => {
  it('normalise casse, accents et espaces', () => {
    expect(normalizeSearchText('  Consignes  Été  TA ')).toBe('consignes ete ta');
    expect(normalizeSearchText(null)).toBe('');
  });
});

describe('DocumentLibraryService — listVisibleLinks', () => {
  const publicLink = makeLink({ id: 1, title: 'Charte du rassemblement' });
  const restrictedLink = makeLink({
    id: 2,
    title: 'Consignes temps TA',
    visibility: DocumentLinkVisibility.TEAMS,
    teamRestrictions: [
      {
        volunteerTeamId: 10,
        volunteerTeam: { id: 10, name: 'Cuisine', code: 'CUS', isActive: true },
      },
    ],
  });
  const otherTeamLink = makeLink({
    id: 3,
    title: 'Plan de secours',
    visibility: DocumentLinkVisibility.TEAMS,
    teamRestrictions: [
      {
        volunteerTeamId: 20,
        volunteerTeam: { id: 20, name: 'Santé', code: 'SAN', isActive: true },
      },
    ],
  });
  const allLinks = [publicLink, restrictedLink, otherTeamLink];

  const membershipsFor = (rows: object[]) => ({
    membershipsRepository: { find: vi.fn().mockResolvedValue(rows) },
  });

  it('un utilisateur sans affectation ne voit que les fiches ALL', async () => {
    const service = makeService({
      linksRepository: { find: vi.fn().mockResolvedValue(allLinks) },
      volunteersRepository: { findOne: vi.fn().mockResolvedValue(null) },
      ...membershipsFor([]),
    });
    const result = await service.listVisibleLinks(viewerUser, {});
    expect(result.map((link) => link.id)).toEqual([1]);
  });

  it('un membre d une équipe ciblée voit la fiche restreinte (OU)', async () => {
    const service = makeService({
      linksRepository: { find: vi.fn().mockResolvedValue(allLinks) },
      volunteersRepository: { findOne: vi.fn().mockResolvedValue({ id: 50 }) },
      ...membershipsFor([
        {
          volunteerTeamId: 10,
          startAt: null,
          endAt: null,
          volunteerTeam: { id: 10, isActive: true },
        },
      ]),
    });
    const result = await service.listVisibleLinks(plainUser, {});
    expect(result.map((link) => link.id).sort()).toEqual([1, 2]);
  });

  it('une équipe inactive ne donne plus accès', async () => {
    const service = makeService({
      linksRepository: { find: vi.fn().mockResolvedValue(allLinks) },
      volunteersRepository: { findOne: vi.fn().mockResolvedValue({ id: 50 }) },
      ...membershipsFor([
        {
          volunteerTeamId: 10,
          startAt: null,
          endAt: null,
          volunteerTeam: { id: 10, isActive: false },
        },
      ]),
    });
    const result = await service.listVisibleLinks(plainUser, {});
    expect(result.map((link) => link.id)).toEqual([1]);
  });

  it('une affectation dont la date de fin est dépassée ne donne plus accès', async () => {
    const service = makeService({
      linksRepository: { find: vi.fn().mockResolvedValue(allLinks) },
      volunteersRepository: { findOne: vi.fn().mockResolvedValue({ id: 50 }) },
      ...membershipsFor([
        {
          volunteerTeamId: 10,
          startAt: null,
          endAt: '2020-01-01',
          volunteerTeam: { id: 10, isActive: true },
        },
      ]),
    });
    const result = await service.listVisibleLinks(plainUser, {});
    expect(result.map((link) => link.id)).toEqual([1]);
  });

  it('ADMIN voit toutes les fiches, y compris restreintes', async () => {
    const service = makeService({
      linksRepository: { find: vi.fn().mockResolvedValue(allLinks) },
    });
    const result = await service.listVisibleLinks(adminUser, {});
    expect(result.map((link) => link.id).sort()).toEqual([1, 2, 3]);
  });

  it('COORDINATOR voit toutes les fiches, y compris restreintes', async () => {
    const service = makeService({
      linksRepository: { find: vi.fn().mockResolvedValue(allLinks) },
    });
    const result = await service.listVisibleLinks(coordinatorUser, {});
    expect(result.map((link) => link.id).sort()).toEqual([1, 2, 3]);
  });

  it('filtre par recherche insensible aux accents et à la casse', async () => {
    const service = makeService({
      linksRepository: { find: vi.fn().mockResolvedValue(allLinks) },
    });
    const result = await service.listVisibleLinks(adminUser, { search: 'secours' });
    expect(result.map((link) => link.id)).toEqual([3]);
  });

  it('filtre par catégorie', async () => {
    const categorized = makeLink({ id: 4, categoryId: 7, title: 'Grille horaire' });
    const service = makeService({
      linksRepository: { find: vi.fn().mockResolvedValue([publicLink, categorized]) },
    });
    const result = await service.listVisibleLinks(adminUser, { categoryId: 7 });
    expect(result.map((link) => link.id)).toEqual([4]);
  });
});

describe('DocumentLibraryService — findVisibleLink', () => {
  it('renvoie 404 pour une fiche restreinte invisible (contrôle serveur par fiche)', async () => {
    const restricted = makeLink({
      id: 2,
      visibility: DocumentLinkVisibility.TEAMS,
      teamRestrictions: [{ volunteerTeamId: 10, volunteerTeam: { id: 10, isActive: true } }],
    });
    const service = makeService({
      linksRepository: { findOne: vi.fn().mockResolvedValue(restricted) },
      volunteersRepository: { findOne: vi.fn().mockResolvedValue(null) },
      membershipsRepository: { find: vi.fn().mockResolvedValue([]) },
    });
    await expect(service.findVisibleLink(viewerUser, 2)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DocumentLibraryService — createLink', () => {
  const baseDto = {
    title: 'Guide ES animateurs',
    url: 'https://mej.sharepoint.com/sites/allegria/guide.pdf',
    visibility: DocumentLinkVisibility.ALL,
  };

  it('rejette une URL invalide', async () => {
    const service = makeService({});
    await expect(
      service.createLink(adminUser, { ...baseDto, url: 'pas-une-url' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejette un protocole non http(s)', async () => {
    const service = makeService({});
    await expect(
      service.createLink(adminUser, { ...baseDto, url: 'ftp://exemple.fr/doc.pdf' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige au moins une équipe pour une fiche restreinte', async () => {
    const service = makeService({});
    await expect(
      service.createLink(adminUser, {
        ...baseDto,
        visibility: DocumentLinkVisibility.TEAMS,
        teamIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejette des équipes introuvables', async () => {
    const service = makeService({
      teamsRepository: { findBy: vi.fn().mockResolvedValue([]) },
    });
    await expect(
      service.createLink(adminUser, {
        ...baseDto,
        visibility: DocumentLinkVisibility.TEAMS,
        teamIds: [99],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crée une fiche publique et enregistre l auteur', async () => {
    const saved = makeLink({ id: 42 });
    const service = makeService({
      linksRepository: {
        create: vi.fn((input) => input),
        save: vi.fn().mockResolvedValue({ ...saved }),
        findOne: vi.fn().mockResolvedValue(saved),
      },
      linkTeamsRepository: {
        delete: vi.fn(),
        create: vi.fn((x) => x),
        save: vi.fn().mockResolvedValue([]),
      },
    });
    const result = await service.createLink(adminUser, baseDto);
    expect(result.id).toBe(42);
    expect(result.visibility).toBe(DocumentLinkVisibility.ALL);
  });
});

describe('DocumentLibraryService — catégories', () => {
  it('normalise le code en majuscules sans accents', async () => {
    const saved = {
      id: 1,
      code: 'ANIMATION_SPIRITUELLE',
      label: 'Animation spirituelle',
      parentId: null,
      sortOrder: 0,
      isActive: true,
    };
    const categoriesRepository = {
      findOneBy: vi.fn().mockResolvedValue(null),
      create: vi.fn((x) => x),
      save: vi.fn().mockResolvedValue(saved),
    };
    const service = makeService({ categoriesRepository });
    const result = await service.createCategory({
      code: 'animation spirituelle',
      label: 'Animation spirituelle',
    });
    expect(categoriesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ANIMATION_SPIRITUELLE' }),
    );
    expect(result.code).toBe('ANIMATION_SPIRITUELLE');
  });

  it('rejette un code déjà utilisé', async () => {
    const service = makeService({
      categoriesRepository: {
        findOneBy: vi.fn().mockResolvedValue({ id: 5, code: 'TA' }),
      },
    });
    await expect(service.createCategory({ code: 'TA', label: 'TA bis' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('empêche une catégorie d être sa propre sous-catégorie', async () => {
    const service = makeService({
      categoriesRepository: {
        findOneBy: vi.fn().mockResolvedValue({ id: 5, code: 'TA', parentId: null }),
      },
    });
    await expect(service.updateCategory(5, { parentId: 5 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
