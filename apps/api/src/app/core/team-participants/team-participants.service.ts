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
      relations: { group: true },
    });

    if (!team || (!scope.all && !scope.groupIds.includes(team.group?.id ?? -1))) {
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
      relations: { team: { group: true }, participant: { group: true } },
    });

    if (
      !membership ||
      (!scope.all &&
        (!scope.groupIds.includes(membership.team.group?.id ?? -1) ||
          !scope.groupIds.includes(membership.participant.group?.id ?? -1)))
    ) {
      throw new NotFoundException(
        `Affectation team=${teamId} participant=${participantId} introuvable`,
      );
    }

    await this.teamParticipantsRepository.remove(membership);
  }
}
