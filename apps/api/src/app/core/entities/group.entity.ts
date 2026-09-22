import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Participant } from './participant.entity';
import { Team } from './team.entity';

@Entity({ name: 'groups' })
export class Group {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  diocese!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  arrivalDatetime!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  departureDatetime!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(() => Team, (team) => team.group)
  teams!: Team[];

  @OneToMany(() => Participant, (participant) => participant.group)
  participants!: Participant[];
}
