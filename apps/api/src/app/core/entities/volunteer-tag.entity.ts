import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Volunteer } from './volunteer.entity';

@Entity({ name: 'volunteer_tags' })
export class VolunteerTag {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'volunteer_id', type: 'int' })
  volunteerId!: number;

  @ManyToOne(() => Volunteer, (volunteer) => volunteer.tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'volunteer_id' })
  volunteer!: Volunteer;

  @Column({ type: 'text' })
  value!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
