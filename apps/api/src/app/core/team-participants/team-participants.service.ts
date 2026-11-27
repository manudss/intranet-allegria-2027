import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AccessScopeInfo } from '../auth/access-module.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Participant, Team, TeamParticipant, TeamParticipantRole } from '../entities';
import { AddTeamParticipantDto } from './team-participants.types';
import { isTeamInScope, isTeamWritableInScope } from '../teams/team-scope';

@Injectable()
export class TeamParticipantsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamsRepository: Repository<Team>,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    @InjectRepository(TeamParticipant)
    private readonly teamParticipantsRepository: Repository<TeamParticipant>,
  ) {}

  async addParticipant(
    teamId: number,
    dto: AddTeamParticipantDto,
    scope: AccessScopeInfo = { all: true },
  ): Promise<TeamParticipant> {
    const team = await this.teamsRepository.findOne({
      where: { id: teamId },
      relations: { members: { participant: { group: true } } },
    });

    // Composition : l'équipe doit être dans la portée dérivée de ses membres, ou vide
    // (elle rejoint alors la portée du premier membre rattaché). Voir team-scope.ts.
    if (!team || !isTeamWritableInScope(team, scope)) {
      throw new NotFoundException(`Equipe ${teamId} introuvable`);
    }

    const participant = await this.participantsRepository.findOne({
      where: { id: dto.participantId },
      relations: { group: true },
    });

    if (!participant || (!scope.all && !scope.groupIds.includes(participant.group?.id ?? -1))) {
      throw new NotFoundException(`Participant ${dto.participantId} introuvable`);
    }

    const existingMembership = await this.teamParticipantsRepository.findOne({
      where: { team: { id: teamId }, participant: { id: dto.participantId } },
      relations: { team: true, participant: true },
    });

    if (existingMembership) {
      throw new ConflictException('Le participant est deja dans cette equipe');
    }

    const currentSize = await this.teamParticipantsRepository.count({
      where: { team: { id: teamId } },
    });

    if (currentSize >= team.maxSize) {
      throw new BadRequestException(`Equipe complete: taille max ${team.maxSize}`);
    }

    const membership = this.teamParticipantsRepository.create({
      team,
      participant,
      role: dto.role ?? TeamParticipantRole.MEMBER,
      notes: dto.notes ?? null,
    });

    return this.teamParticipantsRepository.save(membership);
  }

  async removeParticipant(
    teamId: number,
    participantId: number,
    scope: AccessScopeInfo = { all: true },
  ): Promise<void> {
    const membership = await this.teamParticipantsRepository.findOne({
      where: { team: { id: teamId }, participant: { id: participantId } },
      relations: {
        team: { members: { participant: { group: true } } },
        participant: { group: true },
      },
    });

    // Le membre retiré doit être dans la portée du compte (jamais celle d'une autre
    // délégation, même dans une équipe mixte) et l'équipe dans la portée dérivée.
    if (
      !membership ||
      !isTeamInScope(membership.team, scope) ||
      (!scope.all && !scope.groupIds.includes(membership.participant.group?.id ?? -1))
    ) {
      throw new NotFoundException(
        `Affectation team=${teamId} participant=${participantId} introuvable`,
      );
    }

    await this.teamParticipantsRepository.remove(membership);
  }
}
