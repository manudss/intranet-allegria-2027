import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthTokenGuard } from '../auth/auth-token.guard';
import { RoleGuard } from '../auth/role.guard';
import { AccessModule, AccessLevelRequired } from '../auth/access-module.decorator';
import { DocumentLibraryService } from './document-library.service';
import {
  CreateDocumentCategoryDto,
  CreateDocumentLinkDto,
  DocumentLinkQueryDto,
  UpdateDocumentCategoryDto,
  UpdateDocumentLinkDto,
} from './document-library.types';

const WRITE_ROLES = ['ADMIN', 'COORDINATOR'];

type UserRequest = { user: { id: number; email: string; roles: string[] } };

/**
 * Rubrique « Consignes & documents ».
 *
 * Lecture : tout utilisateur connecté. Les fiches « ALL » sont visibles de tous ;
 * les fiches « TEAMS » ne sont visibles que des membres d'au moins une équipe
 * ciblée (OU), équipe active et affectation active (règle de dates confirmée,
 * voir DocumentLibraryService). ADMIN/COORDINATOR voient tout.
 * Écriture (fiches + catégories) : ADMIN et COORDINATOR uniquement.
 *
 * Les fichiers restent hébergés sur le SharePoint MEJ : la fiche ne modifie ni
 * le fichier ni son partage ; l'ouverture exige un compte Microsoft autorisé,
 * indépendamment des droits Allegria.
 */
@ApiTags('DocumentLibrary')
@ApiBearerAuth('bearer')
@UseGuards(AuthTokenGuard, RoleGuard)
@Controller()
export class DocumentLibraryController {
  constructor(private readonly documentLibraryService: DocumentLibraryService) {}

  @ApiOperation({ summary: 'Catalogue des fiches visibles pour l utilisateur connecté' })
  @Get('document-links')
  listLinks(@Req() req: UserRequest, @Query() query: DocumentLinkQueryDto) {
    return this.documentLibraryService.listVisibleLinks(req.user, query);
  }

  @ApiOperation({ summary: 'Fiche par id, si visible pour l utilisateur connecté' })
  @Get('document-links/:id')
  findLink(@Req() req: UserRequest, @Param('id', ParseIntPipe) id: number) {
    return this.documentLibraryService.findVisibleLink(req.user, id);
  }

  @ApiOperation({ summary: 'Créer une fiche document (ADMIN/COORDINATOR)' })
  @AccessModule('DOCUMENTS')
  @AccessLevelRequired('EDIT')
  @Post('document-links')
  createLink(@Req() req: UserRequest, @Body() dto: CreateDocumentLinkDto) {
    return this.documentLibraryService.createLink(req.user, dto);
  }

  @ApiOperation({ summary: 'Mettre à jour une fiche document (ADMIN/COORDINATOR)' })
  @AccessModule('DOCUMENTS')
  @AccessLevelRequired('EDIT')
  @Patch('document-links/:id')
  updateLink(
    @Req() req: UserRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocumentLinkDto,
  ) {
    return this.documentLibraryService.updateLink(req.user, id, dto);
  }

  @ApiOperation({ summary: 'Supprimer une fiche document (ADMIN/COORDINATOR)' })
  @AccessModule('DOCUMENTS')
  @AccessLevelRequired('EDIT')
  @Delete('document-links/:id')
  async removeLink(@Param('id', ParseIntPipe) id: number) {
    await this.documentLibraryService.removeLink(id);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Lister les catégories de documents' })
  @Get('document-categories')
  listCategories() {
    return this.documentLibraryService.listCategories();
  }

  @ApiOperation({ summary: 'Créer une catégorie (ADMIN/COORDINATOR)' })
  @AccessModule('DOCUMENTS')
  @AccessLevelRequired('EDIT')
  @Post('document-categories')
  createCategory(@Body() dto: CreateDocumentCategoryDto) {
    return this.documentLibraryService.createCategory(dto);
  }

  @ApiOperation({ summary: 'Mettre à jour une catégorie (ADMIN/COORDINATOR)' })
  @AccessModule('DOCUMENTS')
  @AccessLevelRequired('EDIT')
  @Patch('document-categories/:id')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDocumentCategoryDto) {
    return this.documentLibraryService.updateCategory(id, dto);
  }

  @ApiOperation({ summary: 'Supprimer une catégorie (ADMIN/COORDINATOR)' })
  @AccessModule('DOCUMENTS')
  @AccessLevelRequired('EDIT')
  @Delete('document-categories/:id')
  async removeCategory(@Param('id', ParseIntPipe) id: number) {
    await this.documentLibraryService.removeCategory(id);
    return { deleted: true };
  }
}
