import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { DocumentLink } from './document-link.entity';
import { VolunteerTeam } from './volunteer-team.entity';

@Entity({ name: 'document_link_teams' })
@Unique('uq_document_link_team', ['documentLink', 'volunteerTeam'])
export class DocumentLinkTeam {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'document_link_id', type: 'int' })
  documentLinkId!: number;

  @ManyToOne(() => DocumentLink, (link) => link.teamRestrictions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_link_id' })
  documentLink!: DocumentLink;

  @Column({ name: 'volunteer_team_id', type: 'int' })
  volunteerTeamId!: number;

  @ManyToOne(() => VolunteerTeam, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'volunteer_team_id' })
  volunteerTeam!: VolunteerTeam;
}
