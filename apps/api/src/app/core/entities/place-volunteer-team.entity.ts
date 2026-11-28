import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Place } from './place.entity';
import { VolunteerTeam } from './volunteer-team.entity';

/** Équipe opérationnelle de bénévoles rattachée à un lieu (équipe du lieu). */
@Entity({ name: 'place_volunteer_teams' })
export class PlaceVolunteerTeam {
  @PrimaryColumn({ name: 'place_id', type: 'int' })
  placeId!: number;

  @PrimaryColumn({ name: 'volunteer_team_id', type: 'int' })
  volunteerTeamId!: number;

  @ManyToOne(() => Place, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'place_id' })
  place!: Place;

  @ManyToOne(() => VolunteerTeam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'volunteer_team_id' })
  volunteerTeam!: VolunteerTeam;
}
