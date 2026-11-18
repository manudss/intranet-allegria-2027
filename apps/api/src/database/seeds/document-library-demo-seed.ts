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
 * Les 22 fiches reprennent les documents de démonstration déposés dans le
 * dossier « Documents » du SharePoint MEJ de test (site alegriadmo) :
 * contenus fictifs, aucune donnée réelle. Leur ouverture exige un compte
 * Microsoft autorisé sur ce SharePoint ; il n'y a pas de lien anonyme.
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
      title: 'Formation animateurs - support de session',
      description: 'Support de la session de formation des animateurs.',
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Animateurs/formation-animateurs-support.pdf',
      fileType: DocumentFileType.PDF,
      categoryCode: 'ANIMATEURS',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Guide de l\'animateur ALEGRIA',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Animateurs/guide-animateur-allegria.docx',
      fileType: DocumentFileType.DOCX,
      categoryCode: 'ANIMATEURS',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Grand jeu J2 - règles et déroulé',
      description: 'Règles et déroulé du grand jeu du jour 2.',
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Animation/grand-jeu-j2-regles.docx',
      fileType: DocumentFileType.DOCX,
      categoryCode: 'ANIMATION',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Veillée inter-équipes J3 - fiche animateur',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Animation/veillee-inter-equipes-j3.pdf',
      fileType: DocumentFileType.PDF,
      categoryCode: 'ANIMATION',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Célébration d\'ouverture - déroulé',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Animation-spirituelle/celebration-ouverture-deroule.pdf',
      fileType: DocumentFileType.PDF,
      categoryCode: 'ANIMATION_SPIRITUELLE',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Prière du matin - guide pour les équipes',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Animation-spirituelle/priere-du-matin-guide.docx',
      fileType: DocumentFileType.DOCX,
      categoryCode: 'ANIMATION_SPIRITUELLE',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Charte du bénévole',
      description: 'Charte lue et signée par tous les bénévoles.',
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Benevoles/charte-benevole.pdf',
      fileType: DocumentFileType.PDF,
      categoryCode: 'BENEVOLES',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Planning des pôles bénévoles (fictif)',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Benevoles/planning-poles-benevoles.xlsx',
      fileType: DocumentFileType.XLSX,
      categoryCode: 'BENEVOLES',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Calendrier de communication (fictif)',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Communication/calendrier-communication.xlsx',
      fileType: DocumentFileType.XLSX,
      categoryCode: 'COMMUNICATION',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Charte de communication ALEGRIA',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Communication/charte-communication.docx',
      fileType: DocumentFileType.DOCX,
      categoryCode: 'COMMUNICATION',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Guide ES - repères pour animateurs',
      description: 'Guide de préparation des animateurs ES.',
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/ES/guide-es-animateurs.pdf',
      fileType: DocumentFileType.PDF,
      categoryCode: 'ES',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Programme ES J1 à J4 (fictif)',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/ES/programme-es-j1-j4.docx',
      fileType: DocumentFileType.DOCX,
      categoryCode: 'ES',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Budget prévisionnel ALEGRIA 2027 (fictif)',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Finances/budget-previsionnel-allegria.xlsx',
      fileType: DocumentFileType.XLSX,
      categoryCode: 'FINANCES',
      visibility: DocumentLinkVisibility.TEAMS,
      teamPrefix: 'LOG',
    },
    {
      title: 'Procédure de remboursement des bénévoles',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Finances/procedure-remboursement-benevoles.pdf',
      fileType: DocumentFileType.PDF,
      categoryCode: 'FINANCES',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Annuaire des liens utiles (fictifs)',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Lien-externe/annuaire-liens-utiles.xlsx',
      fileType: DocumentFileType.XLSX,
      categoryCode: 'LIEN_EXTERNE',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Ressources et sites utiles',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Lien-externe/ressources-sites-utiles.docx',
      fileType: DocumentFileType.DOCX,
      categoryCode: 'LIEN_EXTERNE',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Inventaire matériel cuisine et restauration',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Logistique/inventaire-materiel-cuisine.xlsx',
      fileType: DocumentFileType.XLSX,
      categoryCode: 'LOGISTIQUE',
      visibility: DocumentLinkVisibility.TEAMS,
      teamPrefix: 'CUS',
    },
    {
      title: 'Plan d\'installation du site',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Logistique/plan-installation-site.pdf',
      fileType: DocumentFileType.PDF,
      categoryCode: 'LOGISTIQUE',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Livret de chants du rassemblement',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Musique/livret-chants-allegria.docx',
      fileType: DocumentFileType.DOCX,
      categoryCode: 'MUSIQUE',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Planning des répétitions musiciens et choristes',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/Musique/planning-repetitions-musique.xlsx',
      fileType: DocumentFileType.XLSX,
      categoryCode: 'MUSIQUE',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Consignes pour les temps TA',
      description: 'Déroulé et consignes des grands temps TA.',
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/TA/consignes-temps-ta.docx',
      fileType: DocumentFileType.DOCX,
      categoryCode: 'TA',
      visibility: DocumentLinkVisibility.ALL,
    },
    {
      title: 'Répartition des groupes TA (fictive)',
      description: null,
      url: 'https://mejasso.sharepoint.com/sites/alegriadmo/Documents%20partages/Documents/TA/repartition-groupes-ta.xlsx',
      fileType: DocumentFileType.XLSX,
      categoryCode: 'TA',
      visibility: DocumentLinkVisibility.TEAMS,
      teamPrefix: 'ACC',
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
