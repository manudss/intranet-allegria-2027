import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AccessModule,
  AccessScope,
  AccessScopeInfo,
  GroupScopeAware,
} from '../auth/access-module.decorator';
import { RoleGuard } from '../auth/role.guard';
import { AssignmentPersonType } from '../entities';
import { DelegationsService } from './delegations.service';
import { CreateNoteDto, NotesFeedQueryDto, ReplyNoteDto } from './delegations.types';

type UserRequest = { user: { id: number; email: string; roles: string[] } };

/**
 * Notes sur les personnes : commentaires signés et datés, visibles dans la liste
 * des participants, avec page de suivi. Périmètre « groupes autorisés » : le
 * responsable ne voit que les personnes et les notes de sa délégation. Les notes
 * restent logistiques ; elles ne remplacent jamais le dossier santé.
 */
@ApiTags('PersonNotes')
@UseGuards(RoleGuard)
@AccessModule('PARTICIPANTS')
@GroupScopeAware()
@Controller('person-notes')
export class PersonNotesController {
  constructor(private readonly delegationsService: DelegationsService) {}

  @ApiOperation({ summary: 'Fil de suivi des notes (avec notes / sans réponse / toutes)' })
  @Get()
  feed(
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: NotesFeedQueryDto,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.delegationsService.notesFeed(scope, query.filter, query.q);
  }

  @ApiOperation({ summary: 'Notes et réponses d une personne' })
  @Get('person/:personType/:personId')
  list(
    @Param('personType', new ParseEnumPipe(AssignmentPersonType)) personType: AssignmentPersonType,
    @Param('personId', ParseIntPipe) personId: number,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    return this.delegationsService.listNotes(personType, personId, scope);
  }

  @ApiOperation({ summary: 'Ajouter une note sur une personne' })
  @Post('person/:personType/:personId')
  async create(
    @Param('personType', new ParseEnumPipe(AssignmentPersonType)) personType: AssignmentPersonType,
    @Param('personId', ParseIntPipe) personId: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateNoteDto,
    @Req() req: UserRequest,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    const author = await this.delegationsService.resolveAuthor(
      req.user.id,
      req.user.email,
      req.user.roles,
    );
    return this.delegationsService.createNote(personType, personId, dto, author, scope);
  }

  @ApiOperation({ summary: 'Répondre à une note' })
  @Post(':id/replies')
  async reply(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: ReplyNoteDto,
    @Req() req: UserRequest,
    @AccessScope() scope: AccessScopeInfo,
  ) {
    const author = await this.delegationsService.resolveAuthor(
      req.user.id,
      req.user.email,
      req.user.roles,
    );
    return this.delegationsService.replyToNote(id, dto, author, scope);
  }
}
