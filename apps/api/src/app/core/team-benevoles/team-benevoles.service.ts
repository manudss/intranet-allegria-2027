import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AssignmentStatus,
  Participant,
  ParticipantRegistrationStatus,
  PersonSource,
  PersonType,
  Team,
  TeamParticipant,
  TeamParticipantRole,
  Volunteer,
  VolunteerTeamLodging,
} from '../entities';
import { AssignBenevoleDto, BenevoleAssignment } from './team-benevoles.types';

/**
 * Affectation d'un bénévole à une équipe de rassemblement EN TANT QU'ADULTE :
 * une fiche participant de type BENEVOLE (projection du bénévole, sans date de
 * naissance ni sexe) devient membre de l'équipe. Elle compte dans la capacité
 * totale des hébergements et dans le quota d'adultes, jamais dans le quota
 * de mineurs. Le logement du bénévole (volunteer_team_lodgings, affiché dans
 * l'application mobile) est synchronisé dans la même transaction.
 */
@Injectable()
export class TeamBenevolesService {
  constructor(
    @InjectRepository(Team)
    private readonly teamsRepository: Repository<Team>,
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    @InjectRepository(TeamParticipant)
    private readonly teamParticipantsRepository: Repository<TeamParticipant>,
    @InjectRepository(VolunteerTeamLodging)
    private readonly lodgingsRepository: Repository<VolunteerTeamLodging>,
  ) {}

  /** Toutes les affectations bénévoles (pour le board de placement). */
  async listAssignments(): Promise<BenevoleAssignment[]> {
    const fiches = await this.participantsRepository.find({
      where: { type: PersonType.BENEVOLE },
      relations: { volunteer: true, teamMemberships: { team: true } },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    return fiches.filter((f) => f.volunteer).map((f) => this.toAssignment(f));
  }

  /** Bénévoles affectés à une équipe (tiroir de détail de l'équipe). */
  async listForTeam(teamId: number): Promise<BenevoleAssignment[]> {
    const team = await this.teamsRepository.findOneBy({ id: teamId });
    if (!team) throw new NotFoundException(`Equipe ${teamId} introuvable`);
    const fiches = await this.participantsRepository.find({
      where: { type: PersonType.BENEVOLE, teamMemberships: { team: { id: teamId } } },
      relations: { volunteer: true, teamMemberships: { team: true } },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    return fiches.filter((f) => f.volunteer).map((f) => this.toAssignment(f));
  }

  async assign(teamId: number, dto: AssignBenevoleDto): Promise<BenevoleAssignment> {
    if (!dto.volunteerId) throw new BadRequestException('Bénévole requis');
    return this.teamsRepository.manager.transaction(async (manager) => {
      const teams = manager.getRepository(Team);
      const participants = manager.getRepository(Participant);
      const memberships = manager.getRepository(TeamParticipant);
      const lodgings = manager.getRepository(VolunteerTeamLodging);

      const team = await teams.findOneBy({ id: teamId });
      if (!team) throw new NotFoundException(`Equipe ${teamId} introuvable`);
      const volunteer = await this.volunteersRepository.findOneBy({ id: dto.volunteerId });
      if (!volunteer) throw new NotFoundException(`Bénévole ${dto.volunteerId} introuvable`);

      let fiche = await participants.findOne({
        where: { type: PersonType.BENEVOLE, volunteer: { id: volunteer.id } },
        relations: { teamMemberships: { team: true } },
      });
      const current = fiche?.teamMemberships?.[0];
      if (current) {
        if (current.team.id === teamId) {
          throw new ConflictException('Ce bénévole est déjà dans cette équipe');
        }
        throw new ConflictException(
          `Ce bénévole est déjà affecté à l'équipe ${current.team.name} : retirez-le d'abord`,
        );
      }

      const currentSize = await memberships.count({ where: { team: { id: teamId } } });
      if (currentSize >= team.maxSize) {
        throw new BadRequestException(`Equipe complete: taille max ${team.maxSize}`);
      }

      if (!fiche) {
        fiche = await participants.save(
          participants.create({
            firstName: volunteer.firstName,
            lastName: volunteer.lastName,
            type: PersonType.BENEVOLE,
            dateOfBirth: null,
            sex: null,
            mejAgeGroup: null,
            volunteer,
            group: null,
            status: ParticipantRegistrationStatus.CONFIRMED,
            source: PersonSource.STAFF,
            emergencyContactName: null,
            emergencyContactPhone: null,
            diocese: null,
            city: null,
          }),
        );
      }

      await memberships.save(
        memberships.create({
          team,
          participant: fiche,
          role: TeamParticipantRole.MEMBER,
          notes: dto.notes ?? null,
        }),
      );

      // Synchronise le logement affiché dans l'application mobile (Mon hébergement).
      const lodging = await lodgings.findOne({ where: { volunteerId: volunteer.id } });
      if (lodging) {
        if (lodging.teamId !== teamId) {
          lodging.teamId = teamId;
          await lodgings.save(lodging);
        }
      } else {
        await lodgings.save(
          lodgings.create({ volunteerId: volunteer.id, teamId, room: null, notes: null, startAt: null, endAt: null }),
        );
      }

      return {
        volunteerId: volunteer.id,
        participantId: fiche.id,
        teamId,
        teamName: team.name,
        firstName: volunteer.firstName,
        lastName: volunteer.lastName,
        mission: volunteer.team ?? null,
      };
    });
  }

  async unassign(teamId: number, volunteerId: number): Promise<void> {
    await this.teamsRepository.manager.transaction(async (manager) => {
      const participants = manager.getRepository(Participant);
      const memberships = manager.getRepository(TeamParticipant);
      const lodgings = manager.getRepository(VolunteerTeamLodging);

      const fiche = await participants.findOne({
        where: { type: PersonType.BENEVOLE, volunteer: { id: volunteerId } },
        relations: { teamMemberships: { team: true }, hostFamilyAssignments: true },
      });
      const membership = fiche?.teamMemberships?.find((m) => m.team.id === teamId);
      if (!fiche || !membership) {
        throw new NotFoundException(
          `Affectation team=${teamId} benevole=${volunteerId} introuvable`,
        );
      }
      const placed = (fiche.hostFamilyAssignments ?? []).some(
        (a) => a.status !== AssignmentStatus.CANCELLED,
      );
      if (placed) {
        throw new ConflictException(
          "Ce bénévole est placé dans une famille d'accueil : retirez d'abord son affectation (étape 2 du placement)",
        );
      }
      await memberships.remove(membership);
      // La fiche BENEVOLE n'est qu'une projection du bénévole : elle disparaît avec l'affectation.
      await participants.remove(fiche);
      const lodging = await lodgings.findOne({ where: { volunteerId } });
      if (lodging && lodging.teamId === teamId) {
        await lodgings.remove(lodging);
      }
    });
  }

  private toAssignment(fiche: Participant): BenevoleAssignment {
    const membership = fiche.teamMemberships?.[0];
    return {
      volunteerId: fiche.volunteer!.id,
      participantId: fiche.id,
      teamId: membership?.team.id ?? 0,
      teamName: membership?.team.name ?? '',
      firstName: fiche.volunteer!.firstName,
      lastName: fiche.volunteer!.lastName,
      mission: fiche.volunteer!.team ?? null,
    };
  }
}
