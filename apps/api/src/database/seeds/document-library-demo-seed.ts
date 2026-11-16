import type { DataSource } from 'typeorm';
import {
  DocumentCategory,
  DocumentFileType,
  DocumentLink,
  DocumentLinkTeam,
  DocumentLinkVisibility,
  User,
  VolunteerTeam,
} from '../../app/core/entities';

const CATEGORY_SEED: Array<{ code: string; label: string; sortOrder: number }> = [
  { code: 'MUSIQUE', label: 'Musique', sortOrder: 10 },
  { code: 'ANIMATION', label: 'Animation', sortOrder: 20 },
  { code: 'ANIMATION_SPIRITUELLE', label: 'Animation spirituelle', sortOrder: 30 },
  { code: 'LOGISTIQUE', label: 'Logistique', sortOrder: 40 },
  { code: 'LIEN_EXTERNE', label: 'Lien externe', sortOrder: 50 },
  { code: 'COMMUNICATION', label: 'Communication', sortOrder: 60 },
  { code: 'FINANCES', label: 'Finances', sortOrder: 70 },
  { code: 'TA', label: 'TA', sortOrder: 80 },
  { code: 'ES', label: 'ES', sortOrder: 90 },
  { code: 'ANIMATEURS', label: 'Animateurs', sortOrder: 100 },
  { code: 'BENEVOLES', label: 'Bénévoles', sortOrder: 110 },
];

/**
 * Données de démonstration de la rubrique « Consignes & documents ».
 * Les URL sont fictives : les vrais fichiers restent hébergés sur le
 * SharePoint MEJ et leur ouverture dépend du compte Microsoft de l'utilisateur.
 */
export async function insertDocumentLibraryDemo(dataSource: DataSource): Promise<number> {
  const categoryRepository = dataSource.getRepository(DocumentCategory);
  const linkRepository = dataSource.getRepository(DocumentLink);
  const linkTeamRepository = dataSource.getRepository(DocumentLinkTeam);
  const teamRepository = dataSource.getRepository(VolunteerTeam);
  const userRepository = dataSource.getRepository(User);

  const categories = await categoryRepository.save(
    CATEGORY_SEED.map((seed) => categoryRepository.create(seed)),
  );
  const categoryByCode = new Map(categories.map((category) => [category.code, category]));

  const admin = await userRepository.findOneBy({ email: 'admin@allegria.local' });
  const teamByCodePrefix = async (prefix: string): Promise<VolunteerTeam | null> =>
    (await teamRepository
      .createQueryBuilder('team')
      .where('team.code LIKE :prefix', { prefix: `${prefix}-%` })
      .orderBy('team.code', 'ASC')
      .getOne()) ?? null;

  const demoLinks: Array<{
    title: string;
    description: string | null;
    url: string;
    fileType: DocumentFileType;
    categoryCode: string;
    visibility: DocumentLinkVisibility;
    teamPrefix?: string;
  }> = [
    {
      title: 'Charte du rassemblement',
      description: 'Charte lue et signée par tous les participants.',
      url: 'https://mej.sharepoint.com/sites/allegria/Documents/charte-rassemblement.pdf',
      fileType: DocumentFileType.PDF,
      categoryCode: 'ANIMATION_SPIRITUELLE',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Consignes temps TA',
      description: 'Déroulé et consignes des grands temps TA.',
      url: 'https://mej.sharepoint.com/sites/allegria/Documents/consignes-temps-ta.docx',
      fileType: DocumentFileType.DOCX,
      categoryCode: 'TA',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Guide ES animateurs',
      description: 'Guide de préparation des animateurs ES.',
      url: 'https://mej.sharepoint.com/sites/allegria/Documents/guide-es-animateurs.pdf',
      fileType: DocumentFileType.PDF,
      categoryCode: 'ES',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Programme ES J1-J4',
      description: null,
      url: 'https://mej.sharepoint.com/sites/allegria/Documents/programme-es-j1-j4.docx',
      fileType: DocumentFileType.DOCX,
      categoryCode: 'ES',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Répartition groupes TA',
      description: null,
      url: 'https://mej.sharepoint.com/sites/allegria/Documents/repartition-groupes-ta.xlsx',
      fileType: DocumentFileType.XLSX,
      categoryCode: 'TA',
      visibility: DocumentLinkVisibility.TEAMS,
      teamPrefix: 'ACC',
    },
    {
      title: 'Plan de rotation cuisine',
      description: 'Organisation des services et plages de nettoyage.',
      url: 'https://mej.sharepoint.com/sites/allegria/Documents/plan-rotation-cuisine.xlsx',
      fileType: DocumentFileType.XLSX,
      categoryCode: 'LOGISTIQUE',
      visibility: DocumentLinkVisibility.TEAMS,
      teamPrefix: 'CUS',
    },
    {
      title: 'Kit communication réseaux',
      description: 'Visuels et textes prêts à publier.',
      url: 'https://mej.sharepoint.com/sites/allegria/Documents/kit-communication.pptx',
      fileType: DocumentFileType.PPTX,
      categoryCode: 'COMMUNICATION',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Budget prévisionnel 2027',
      description: null,
      url: 'https://mej.sharepoint.com/sites/allegria/Documents/budget-2027.xlsx',
      fileType: DocumentFileType.XLSX,
      categoryCode: 'FINANCES',
      visibility: DocumentLinkVisibility.TEAMS,
      teamPrefix: 'LOG',
    },
  ];

  let created = 0;
  for (const demo of demoLinks) {
    const category = categoryByCode.get(demo.categoryCode) ?? null;
    const link = await linkRepository.save(
      linkRepository.create({
        title: demo.title,
        description: demo.description,
        url: demo.url,
        fileType: demo.fileType,
        categoryId: category?.id ?? null,
        visibility: demo.visibility,
        createdByUserId: admin?.id ?? null,
        updatedByUserId: admin?.id ?? null,
      }),
    );
    if (demo.visibility === DocumentLinkVisibility.TEAMS && demo.teamPrefix) {
      const team = await teamByCodePrefix(demo.teamPrefix);
      if (team) {
        await linkTeamRepository.save(
          linkTeamRepository.create({ documentLinkId: link.id, volunteerTeamId: team.id }),
        );
      }
    }
    created += 1;
  }
  return created;
}
