import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ProgramService } from './program.service';

/**
 * Programme public de l'appli non connectée : instantané régénéré par le bouton
 * « Mettre à jour la liste publique », réduit aux grands temps (titre, horaires,
 * lieu). Jamais de donnée temps réel ni de détail interne (chants, consignes,
 * fil rouge, déplacements) — seules les séquences explicitement publiées y figurent.
 */
@ApiTags('Programme public')
@Public()
@Controller('public/program')
export class PublicProgramController {
  constructor(private readonly service: ProgramService) {}

  @ApiOperation({ summary: "Instantané public d'un jour (grands temps seulement)" })
  @Get(':date')
  getPublicDay(@Param('date') date: string) {
    return this.service.getPublicProgramDay(date);
  }
}
