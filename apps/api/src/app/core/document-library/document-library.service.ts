import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  DocumentCategory,
  DocumentFileType,
  DocumentLink,
  DocumentLinkTeam,
  DocumentLinkVisibility,
  Volunteer,
  VolunteerTeam,
  VolunteerTeamMembership,
} from '../entities';
import {
  CreateDocumentCategoryDto,
  CreateDocumentLinkDto,
  DocumentLinkQueryDto,
  UpdateDocumentCategoryDto,
  UpdateDocumentLinkDto,
} from './document-library.types';

type SessionUser = { id: number; email: string; roles: string[] };

const MANAGE_ROLES = ['ADMIN', 'COORDINATOR'];

/** Date du jour au format YYYY-MM-DD, fuseau Europe/Paris. */
export function parisToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
}

/**
 * Règle de dates des affectations, CONFIRMÉE par Emmanuel le 2026-11-16 :
 * - accès dès l'affectation : la date de début (startAt) est ignorée ;
 * - date de fin renseignée : accès valable ce jour-là INCLUS, arrêt le lendemain
 *   (comparaison au jour, heure de Paris) ;
 * - sans date de fin : accès tant que l'affectation existe et que l'équipe est
 *   active (vérifiée par l'appelant).
 *
 * La règle ne porte que sur la consultation Allegria des fiches ; elle ne change
 * rien aux accès SharePoint, gérés par Microsoft. Point d'extension unique : toute
 * évolution ne touche que cette fonction et ses tests unitaires.
 */
export function isMembershipActiveForDocumentAccess(
  membership: Pick<VolunteerTeamMembership, 'startAt' | 'endAt'>,
  today: string = parisToday(),
): boolean {
  void membership.startAt; // accès dès l'affectation : date de début ignorée
  if (!membership.endAt) {
    return true;
  }
  return membership.endAt >= today;
}

/** Normalisation recherche : minuscules, sans accents, espaces compactés. */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export type SerializedDocumentTeam = {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
};

export type SerializedDocumentLink = {
  id: number;
  title: string;
  description: string | null;
  url: string;
  fileType: DocumentFileType;
  visibility: DocumentLinkVisibility;
  categoryId: number | null;
  category: { id: number; code: string; label: string } | null;
  teams: SerializedDocumentTeam[];
  createdByUserId: number | null;
  updatedByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SerializedDocumentCategory = {
  id: number;
  code: string;
  label: string;
  parentId: number | null;
  sortOrder: number;
  isActive: boolean;
};

@Injectable()
export class DocumentLibraryService {
  constructor(
    @InjectRepository(DocumentLink)
    private readonly linksRepository: Repository<DocumentLink>,
    @InjectRepository(DocumentLinkTeam)
    private readonly linkTeamsRepository: Repository<DocumentLinkTeam>,
    @InjectRepository(DocumentCategory)
    private readonly categoriesRepository: Repository<DocumentCategory>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
    @InjectRepository(VolunteerTeam)
    private readonly teamsRepository: Repository<VolunteerTeam>,
    @InjectRepository(VolunteerTeamMembership)
    private readonly membershipsRepository: Repository<VolunteerTeamMembership>,
  ) {}

  // ---------- Lecture (tout utilisateur connecté, filtrée par ses droits) ----------

  async listVisibleLinks(
    user: SessionUser,
    query: DocumentLinkQueryDto,
  ): Promise<SerializedDocumentLink[]> {
    const links = await this.linksRepository.find({
      relations: { category: true, teamRestrictions: { volunteerTeam: true } },
      order: { title: 'ASC' },
    });

    const canManage = this.canManage(user);
    const activeTeamIds = canManage ? new Set<number>() : await this.findActiveTeamIds(user.id);

    let visible = canManage ? links : links.filter((link) => this.isVisibleTo(link, activeTeamIds));

    if (query.categoryId !== undefined && query.categoryId !== null) {
      const categoryId = Number(query.categoryId);
      visible = visible.filter((link) => link.categoryId === categoryId);
    }

    const search = normalizeSearchText(query.search);
    if (search) {
      visible = visible.filter((link) => {
        const haystack = normalizeSearchText(
          [link.title, link.description ?? '', link.category?.label ?? ''].join(' '),
        );
        return search.split(' ').every((token) => haystack.includes(token));
      });
    }

    return visible.map((link) => this.serializeLink(link));
  }

  async findVisibleLink(user: SessionUser, id: number): Promise<SerializedDocumentLink> {
    const link = await this.linksRepository.findOne({
      where: { id },
      relations: { category: true, teamRestrictions: { volunteerTeam: true } },
    });
    if (!link) {
      throw new NotFoundException(`Fiche document ${id} introuvable`);
    }
    if (!this.canManage(user)) {
      const activeTeamIds = await this.findActiveTeamIds(user.id);
      if (!this.isVisibleTo(link, activeTeamIds)) {
        // 404 volontaire : ne pas révéler l'existence d'une fiche restreinte.
        throw new NotFoundException(`Fiche document ${id} introuvable`);
      }
    }
    return this.serializeLink(link);
  }

  async listCategories(): Promise<SerializedDocumentCategory[]> {
    const categories = await this.categoriesRepository.find({
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
    return categories.map((category) => this.serializeCategory(category));
  }

  // ---------- Écriture (ADMIN / COORDINATOR, contrôlée aussi par le RoleGuard) ----------

  async createLink(user: SessionUser, dto: CreateDocumentLinkDto): Promise<SerializedDocumentLink> {
    const title = this.normalizeRequiredText(dto.title, 'title');
    const url = this.normalizeUrl(dto.url);
    const visibility = this.normalizeVisibility(dto.visibility);
    const fileType = this.normalizeFileType(dto.fileType);
    const categoryId = await this.normalizeCategoryId(dto.categoryId ?? null);
    const teamIds = await this.normalizeTeamIds(dto.teamIds, visibility);

    const link = this.linksRepository.create({
      title,
      description: this.normalizeOptionalText(dto.description),
      url,
      fileType,
      categoryId,
      visibility,
      createdByUserId: user.id,
      updatedByUserId: user.id,
    });
    const saved = await this.linksRepository.save(link);
    await this.replaceTeamRestrictions(saved.id, teamIds);
    return this.findVisibleLink(user, saved.id);
  }

  async updateLink(
    user: SessionUser,
    id: number,
    dto: UpdateDocumentLinkDto,
  ): Promise<SerializedDocumentLink> {
    const link = await this.linksRepository.findOne({
      where: { id },
      relations: { category: true, teamRestrictions: { volunteerTeam: true } },
    });
    if (!link) {
      throw new NotFoundException(`Fiche document ${id} introuvable`);
    }

    if (dto.title !== undefined) {
      link.title = this.normalizeRequiredText(dto.title, 'title');
    }
    if (dto.description !== undefined) {
      link.description = this.normalizeOptionalText(dto.description);
    }
    if (dto.url !== undefined) {
      link.url = this.normalizeUrl(dto.url);
    }
    if (dto.fileType !== undefined) {
      link.fileType = this.normalizeFileType(dto.fileType);
    }
    if (dto.categoryId !== undefined) {
      link.categoryId = await this.normalizeCategoryId(dto.categoryId);
    }

    const nextVisibility =
      dto.visibility !== undefined ? this.normalizeVisibility(dto.visibility) : link.visibility;
    link.visibility = nextVisibility;

    const nextTeamIds =
      dto.teamIds !== undefined
        ? await this.normalizeTeamIds(dto.teamIds, nextVisibility)
        : link.teamRestrictions.map((restriction) => restriction.volunteerTeamId);
    if (nextVisibility === DocumentLinkVisibility.TEAMS && nextTeamIds.length === 0) {
      throw new BadRequestException(
        'Une fiche restreinte doit cibler au moins une équipe opérationnelle',
      );
    }

    link.updatedByUserId = user.id;
    await this.linksRepository.save(link);
    if (dto.teamIds !== undefined || dto.visibility !== undefined) {
      await this.replaceTeamRestrictions(link.id, nextTeamIds);
    }
    return this.findVisibleLink(user, link.id);
  }

  async removeLink(id: number): Promise<void> {
    const link = await this.linksRepository.findOneBy({ id });
    if (!link) {
      throw new NotFoundException(`Fiche document ${id} introuvable`);
    }
    await this.linksRepository.remove(link);
  }

  async createCategory(dto: CreateDocumentCategoryDto): Promise<SerializedDocumentCategory> {
    const code = this.normalizeCategoryCode(dto.code);
    const label = this.normalizeRequiredText(dto.label, 'label');
    await this.ensureCategoryCodeAvailable(code);
    const parentId = await this.normalizeParentCategoryId(dto.parentId ?? null);
    const category = this.categoriesRepository.create({
      code,
      label,
      parentId,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.categoriesRepository.save(category);
    return this.serializeCategory(saved);
  }

  async updateCategory(
    id: number,
    dto: UpdateDocumentCategoryDto,
  ): Promise<SerializedDocumentCategory> {
    const category = await this.categoriesRepository.findOneBy({ id });
    if (!category) {
      throw new NotFoundException(`Catégorie ${id} introuvable`);
    }
    if (dto.code !== undefined) {
      const code = this.normalizeCategoryCode(dto.code);
      if (code !== category.code) {
        await this.ensureCategoryCodeAvailable(code);
      }
      category.code = code;
    }
    if (dto.label !== undefined) {
      category.label = this.normalizeRequiredText(dto.label, 'label');
    }
    if (dto.parentId !== undefined) {
      const parentId = await this.normalizeParentCategoryId(dto.parentId);
      if (parentId === id) {
        throw new BadRequestException('Une catégorie ne peut pas être sa propre sous-catégorie');
      }
      category.parentId = parentId;
    }
    if (dto.sortOrder !== undefined) {
      category.sortOrder = dto.sortOrder;
    }
    if (dto.isActive !== undefined) {
      category.isActive = dto.isActive;
    }
    const saved = await this.categoriesRepository.save(category);
    return this.serializeCategory(saved);
  }

  async removeCategory(id: number): Promise<void> {
    const category = await this.categoriesRepository.findOneBy({ id });
    if (!category) {
      throw new NotFoundException(`Catégorie ${id} introuvable`);
    }
    // Les fiches rattachées passent à categoryId NULL (FK ON DELETE SET NULL),
    // les sous-catégories sont remontées au niveau racine (parent_id NULL).
    await this.categoriesRepository.remove(category);
  }

  // ---------- Règles d'accès ----------

  private canManage(user: SessionUser): boolean {
    return MANAGE_ROLES.some((role) => user.roles.includes(role));
  }

  private isVisibleTo(link: DocumentLink, activeTeamIds: Set<number>): boolean {
    if (link.visibility === DocumentLinkVisibility.ALL) {
      return true;
    }
    // OU : appartenir à au moins une des équipes ciblées suffit.
    return (link.teamRestrictions ?? []).some((restriction) =>
      activeTeamIds.has(restriction.volunteerTeamId),
    );
  }

  /** Équipes opérationnelles donnant accès : équipe active ET affectation active au sens de la règle de dates confirmée. */
  private async findActiveTeamIds(userId: number): Promise<Set<number>> {
    const volunteer = await this.volunteersRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!volunteer) {
      return new Set();
    }
    const memberships = await this.membershipsRepository.find({
      where: { volunteerId: volunteer.id },
      relations: { volunteerTeam: true },
    });
    const today = parisToday();
    const ids = memberships
      .filter(
        (membership) =>
          membership.volunteerTeam?.isActive === true &&
          isMembershipActiveForDocumentAccess(membership, today),
      )
      .map((membership) => membership.volunteerTeamId);
    return new Set(ids);
  }

  // ---------- Normalisation / validation ----------

  private normalizeRequiredText(value: string | null | undefined, field: string): string {
    const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
      throw new BadRequestException(`Le champ ${field} est obligatoire`);
    }
    return normalized;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    const normalized = (value ?? '').trim();
    return normalized ? normalized : null;
  }

  private normalizeUrl(value: string | null | undefined): string {
    const normalized = (value ?? '').trim();
    if (!normalized) {
      throw new BadRequestException('Le lien du document est obligatoire');
    }
    let parsed: URL;
    try {
      parsed = new URL(normalized);
    } catch {
      throw new BadRequestException('Le lien du document doit être une URL valide');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Le lien du document doit commencer par http:// ou https://');
    }
    return parsed.toString();
  }

  private normalizeVisibility(value: DocumentLinkVisibility | undefined): DocumentLinkVisibility {
    if (value === DocumentLinkVisibility.ALL || value === DocumentLinkVisibility.TEAMS) {
      return value;
    }
    throw new BadRequestException("La visibilité doit être 'ALL' ou 'TEAMS'");
  }

  private normalizeFileType(value: DocumentFileType | undefined): DocumentFileType {
    if (value === undefined || value === null) {
      return DocumentFileType.OTHER;
    }
    if (Object.values(DocumentFileType).includes(value)) {
      return value;
    }
    throw new BadRequestException(`Type de fichier inconnu: ${value}`);
  }

  private async normalizeCategoryId(categoryId: number | null): Promise<number | null> {
    if (categoryId === null || categoryId === undefined) {
      return null;
    }
    const category = await this.categoriesRepository.findOneBy({ id: categoryId });
    if (!category) {
      throw new BadRequestException(`Catégorie ${categoryId} introuvable`);
    }
    return category.id;
  }

  private async normalizeTeamIds(
    teamIds: number[] | undefined,
    visibility: DocumentLinkVisibility,
  ): Promise<number[]> {
    const ids = [...new Set((teamIds ?? []).map((id) => Number(id)))];
    if (visibility === DocumentLinkVisibility.TEAMS && ids.length === 0) {
      throw new BadRequestException(
        'Une fiche restreinte doit cibler au moins une équipe opérationnelle',
      );
    }
    if (ids.length > 0) {
      const teams = await this.teamsRepository.findBy({ id: In(ids) });
      if (teams.length !== ids.length) {
        throw new BadRequestException('Une ou plusieurs équipes ciblées sont introuvables');
      }
    }
    return visibility === DocumentLinkVisibility.ALL ? [] : ids;
  }

  private normalizeCategoryCode(code: string | null | undefined): string {
    const normalized = normalizeSearchText(code)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!normalized) {
      throw new BadRequestException('Le code de la catégorie est obligatoire');
    }
    return normalized;
  }

  private async ensureCategoryCodeAvailable(code: string): Promise<void> {
    const existing = await this.categoriesRepository.findOneBy({ code });
    if (existing) {
      throw new BadRequestException(`La catégorie ${code} existe déjà`);
    }
  }

  private async normalizeParentCategoryId(parentId: number | null): Promise<number | null> {
    if (parentId === null || parentId === undefined) {
      return null;
    }
    const parent = await this.categoriesRepository.findOneBy({ id: parentId });
    if (!parent) {
      throw new BadRequestException(`Catégorie parente ${parentId} introuvable`);
    }
    return parent.id;
  }

  private async replaceTeamRestrictions(linkId: number, teamIds: number[]): Promise<void> {
    await this.linkTeamsRepository.delete({ documentLinkId: linkId });
    if (teamIds.length === 0) {
      return;
    }
    const rows = teamIds.map((teamId) =>
      this.linkTeamsRepository.create({ documentLinkId: linkId, volunteerTeamId: teamId }),
    );
    await this.linkTeamsRepository.save(rows);
  }

  // ---------- Sérialisation ----------

  private serializeLink(link: DocumentLink): SerializedDocumentLink {
    return {
      id: link.id,
      title: link.title,
      description: link.description ?? null,
      url: link.url,
      fileType: link.fileType,
      visibility: link.visibility,
      categoryId: link.categoryId ?? null,
      category: link.category
        ? { id: link.category.id, code: link.category.code, label: link.category.label }
        : null,
      teams: (link.teamRestrictions ?? [])
        .filter((restriction) => restriction.volunteerTeam)
        .map((restriction) => ({
          id: restriction.volunteerTeam.id,
          name: restriction.volunteerTeam.name,
          code: restriction.volunteerTeam.code,
          isActive: restriction.volunteerTeam.isActive,
        })),
      createdByUserId: link.createdByUserId ?? null,
      updatedByUserId: link.updatedByUserId ?? null,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  }

  private serializeCategory(category: DocumentCategory): SerializedDocumentCategory {
    return {
      id: category.id,
      code: category.code,
      label: category.label,
      parentId: category.parentId ?? null,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    };
  }
}
