import { describe, expect, it } from 'vitest';
import {
  DocumentCategory,
  DocumentLink,
  DocumentLinkTeam,
  User,
  VolunteerTeam,
} from '../../app/core/entities';
import {
  DEMO_DOCUMENT_LINKS,
  DOCUMENT_CATEGORY_SEED,
  insertDocumentLibraryDemo,
} from './document-library-demo-seed';

/**
 * Tests du seed démo « Consignes & documents » SANS base de données :
 * un DataSource factice en mémoire reproduit le contrat TypeORM utilisé par
 * le seed (create/save/findOne/findOneBy/createQueryBuilder). Objectif :
 * prouver que l'insertion est idempotente, non destructive et sans
 * écrasement, pour pouvoir l'exécuter sur une base de preview qui contient
 * déjà des données (contrairement au seed complet qui TRUNCATE).
 */

type Row = Record<string, unknown> & { id?: number };

function makeRepo(rows: Row[] = []) {
  let nextId = 1;
  const repo = {
    rows,
    create(seed: Row): Row {
      return { ...seed };
    },
    async save<T extends Row>(entity: T): Promise<T> {
      if (entity.id == null) {
        entity.id = nextId++;
        rows.push(entity);
      }
      return entity;
    },
    async findOne(options?: { where: Row }): Promise<Row | null> {
      const where = options?.where ?? {};
      return (
        rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ??
        null
      );
    },
    async findOneBy(where: Row): Promise<Row | null> {
      return repo.findOne({ where });
    },
    createQueryBuilder() {
      let prefix = '';
      const qb = {
        where(_clause: string, params: { prefix: string }) {
          prefix = params.prefix;
          return qb;
        },
        orderBy() {
          return qb;
        },
        async getOne(): Promise<Row | null> {
          const start = prefix.replace(/%$/, '');
          const matches = rows
            .filter((row) => String(row.code).startsWith(start))
            .sort((a, b) => String(a.code).localeCompare(String(b.code)));
          return matches[0] ?? null;
        },
      };
      return qb;
    },
  };
  return repo;
}

function makeDataSource({
  categories = [] as Row[],
  links = [] as Row[],
  linkTeams = [] as Row[],
  users = [] as Row[],
  teams = [] as Row[],
} = {}) {
  const repos = new Map<unknown, ReturnType<typeof makeRepo>>([
    [DocumentCategory, makeRepo(categories)],
    [DocumentLink, makeRepo(links)],
    [DocumentLinkTeam, makeRepo(linkTeams)],
    [User, makeRepo(users)],
    [VolunteerTeam, makeRepo(teams)],
  ]);
  return {
    repos,
    getRepository: (entity: unknown) => repos.get(entity),
  } as never;
}

const reposOf = (dataSource: unknown) =>
  (dataSource as unknown as { repos: Map<unknown, ReturnType<typeof makeRepo>> }).repos;

const DEMO_TEAMS: Row[] = [
  { id: 1, code: 'LOG-1', isActive: true },
  { id: 2, code: 'CUS-2', isActive: true },
  { id: 3, code: 'ACC-1', isActive: true },
];
const ADMIN: Row = { id: 7, email: 'admin@allegria.local' };

describe('document library demo data', () => {
  it('provides 22 demo links and 11 categories', () => {
    expect(DEMO_DOCUMENT_LINKS).toHaveLength(22);
    expect(DOCUMENT_CATEGORY_SEED).toHaveLength(11);
  });

  it('uses unique https URLs and known category codes', () => {
    const urls = DEMO_DOCUMENT_LINKS.map((link) => link.url);
    expect(new Set(urls).size).toBe(urls.length);
    const codes = new Set(DOCUMENT_CATEGORY_SEED.map((category) => category.code));
    for (const link of DEMO_DOCUMENT_LINKS) {
      expect(link.url.startsWith('https://')).toBe(true);
      expect(codes.has(link.categoryCode)).toBe(true);
    }
  });

  it('only sets a team prefix on team-restricted links', () => {
    for (const link of DEMO_DOCUMENT_LINKS) {
      expect(link.teamPrefix !== undefined).toBe(link.visibility === 'TEAMS');
    }
    expect(DEMO_DOCUMENT_LINKS.filter((link) => link.visibility === 'TEAMS')).toHaveLength(3);
  });
});

describe('insertDocumentLibraryDemo', () => {
  it('inserts all demo data on an empty database', async () => {
    const dataSource = makeDataSource({ users: [{ ...ADMIN }], teams: DEMO_TEAMS.map((t) => ({ ...t })) });
    const result = await insertDocumentLibraryDemo(dataSource);
    expect(result).toEqual({
      categoriesCreated: 11,
      linksCreated: 22,
      linksSkipped: 0,
      linksOmittedMissingTeam: [],
    });
  });

  it('links the 3 restricted documents to their teams and the admin author', async () => {
    const dataSource = makeDataSource({ users: [{ ...ADMIN }], teams: DEMO_TEAMS.map((t) => ({ ...t })) });
    await insertDocumentLibraryDemo(dataSource);
    const repos = reposOf(dataSource);
    const links = repos.get(DocumentLink)!.rows;
    const linkTeams = repos.get(DocumentLinkTeam)!.rows;
    expect(linkTeams).toHaveLength(3);
    for (const link of links.filter((row) => row.visibility === 'TEAMS')) {
      expect(linkTeams.some((team) => team.documentLinkId === link.id)).toBe(true);
    }
    for (const link of links) {
      expect(link.createdByUserId).toBe(ADMIN.id);
    }
  });

  it('is idempotent: a second run creates nothing and keeps counts stable', async () => {
    const dataSource = makeDataSource({ users: [{ ...ADMIN }], teams: DEMO_TEAMS.map((t) => ({ ...t })) });
    await insertDocumentLibraryDemo(dataSource);
    const second = await insertDocumentLibraryDemo(dataSource);
    expect(second).toEqual({
      categoriesCreated: 0,
      linksCreated: 0,
      linksSkipped: 22,
      linksOmittedMissingTeam: [],
    });
    const repos = reposOf(dataSource);
    expect(repos.get(DocumentCategory)!.rows).toHaveLength(11);
    expect(repos.get(DocumentLink)!.rows).toHaveLength(22);
    expect(repos.get(DocumentLinkTeam)!.rows).toHaveLength(3);
  });

  it('reuses categories already created by the migration and preserves manual entries', async () => {
    // État « preview/main » : les 11 catégories existent déjà (migration),
    // plus une fiche saisie à la main pendant un essai.
    const categories = DOCUMENT_CATEGORY_SEED.map((seed, index) => ({ id: 100 + index, ...seed }));
    const manual = { id: 5, title: 'Fiche saisie à la main', url: 'https://example.test/essai', visibility: 'ALL' };
    const dataSource = makeDataSource({
      categories,
      links: [manual],
      users: [{ ...ADMIN }],
      teams: DEMO_TEAMS.map((t) => ({ ...t })),
    });
    const result = await insertDocumentLibraryDemo(dataSource);
    expect(result.categoriesCreated).toBe(0);
    expect(result.linksCreated).toBe(22);
    const links = reposOf(dataSource).get(DocumentLink)!.rows;
    expect(links).toHaveLength(23);
    expect(links.some((link) => link.title === 'Fiche saisie à la main')).toBe(true);
  });

  it('never overwrites a retouched category label or sort order', async () => {
    const categories = DOCUMENT_CATEGORY_SEED.map((seed, index) => ({ id: 200 + index, ...seed }));
    categories[0].label = 'Libellé retouché à la main';
    categories[0].sortOrder = 999;
    const dataSource = makeDataSource({
      categories,
      users: [{ ...ADMIN }],
      teams: DEMO_TEAMS.map((t) => ({ ...t })),
    });
    const result = await insertDocumentLibraryDemo(dataSource);
    expect(result.categoriesCreated).toBe(0);
    const repos = reposOf(dataSource);
    const category = repos.get(DocumentCategory)!.rows.find((row) => row.code === 'MUSIQUE');
    expect(category).toMatchObject({ id: 200, label: 'Libellé retouché à la main', sortOrder: 999 });
    // Les fiches de la catégorie restent rattachées à l'existant (retrouvé par code).
    expect(repos.get(DocumentLink)!.rows.some((link) => link.categoryId === 200)).toBe(true);
  });

  it('skips an already present demo link without overwriting manual edits', async () => {
    const existing = {
      id: 9,
      title: 'Titre corrigé à la main',
      url: DEMO_DOCUMENT_LINKS[0].url,
      visibility: 'ALL',
    };
    const dataSource = makeDataSource({
      links: [existing],
      users: [{ ...ADMIN }],
      teams: DEMO_TEAMS.map((t) => ({ ...t })),
    });
    const result = await insertDocumentLibraryDemo(dataSource);
    expect(result.linksSkipped).toBe(1);
    expect(result.linksCreated).toBe(21);
    const kept = reposOf(dataSource).get(DocumentLink)!.rows.find((link) => link.id === 9);
    expect(kept?.title).toBe('Titre corrigé à la main');
  });

  it('omits team-restricted links when the target team is missing, and says so', async () => {
    // État invalide interdit par l'API : une fiche TEAMS sans restriction
    // serait invisible pour tous sauf ADMIN/COORDINATOR. Le seed ne la crée
    // pas ; il l'omet et la liste, sans élargir ni réduire l'audience.
    const dataSource = makeDataSource({ users: [{ ...ADMIN }] });
    const result = await insertDocumentLibraryDemo(dataSource);
    expect(result.linksCreated).toBe(19);
    expect(result.linksOmittedMissingTeam).toHaveLength(3);
    const repos = reposOf(dataSource);
    expect(repos.get(DocumentLink)!.rows.filter((row) => row.visibility === 'TEAMS')).toHaveLength(0);
    expect(repos.get(DocumentLinkTeam)!.rows).toHaveLength(0);
  });

  it('keeps an existing restricted link even if its team is currently missing', async () => {
    const restricted = DEMO_DOCUMENT_LINKS.find((link) => link.visibility === 'TEAMS')!;
    const existing = { id: 11, title: restricted.title, url: restricted.url, visibility: 'TEAMS' };
    const dataSource = makeDataSource({ links: [existing], users: [{ ...ADMIN }] });
    const result = await insertDocumentLibraryDemo(dataSource);
    expect(result.linksSkipped).toBe(1);
    expect(result.linksOmittedMissingTeam).toHaveLength(2);
    const repos = reposOf(dataSource);
    expect(repos.get(DocumentLink)!.rows.some((link) => link.id === 11)).toBe(true);
    expect(repos.get(DocumentLinkTeam)!.rows).toHaveLength(0);
  });

  it('fills in omitted restricted links once the team exists', async () => {
    const dataSource = makeDataSource({ users: [{ ...ADMIN }] });
    const first = await insertDocumentLibraryDemo(dataSource);
    expect(first.linksOmittedMissingTeam).toHaveLength(3);
    reposOf(dataSource).get(VolunteerTeam)!.rows.push(...DEMO_TEAMS.map((t) => ({ ...t })));
    const second = await insertDocumentLibraryDemo(dataSource);
    expect(second.linksCreated).toBe(3);
    expect(second.linksOmittedMissingTeam).toHaveLength(0);
    expect(reposOf(dataSource).get(DocumentLinkTeam)!.rows).toHaveLength(3);
  });

  it('works without the admin account (author left null)', async () => {
    const dataSource = makeDataSource({ teams: DEMO_TEAMS.map((t) => ({ ...t })) });
    const result = await insertDocumentLibraryDemo(dataSource);
    expect(result.linksCreated).toBe(22);
    const authors = new Set(reposOf(dataSource).get(DocumentLink)!.rows.map((link) => link.createdByUserId));
    expect(authors).toEqual(new Set([null]));
  });
});
