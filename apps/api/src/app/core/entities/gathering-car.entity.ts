import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GatheringCarAssignment } from './gathering-car-assignment.entity';
import { GatheringCarPerson } from './gathering-car-person.entity';
import { GatheringCarStop } from './gathering-car-stop.entity';

/**
 * Car du rassemblement : dessert les groupes d'hébergement et les lieux éloignés
 * du site (distinct des trajets aller/retour des délégations). Jauge facultative
 * (null = sans limite) et jours de circulation libres parmi les dates du rassemblement.
 */
@Entity('gathering_cars')
export class GatheringCar {
  @PrimaryGeneratedColumn() id: number;

  @Column({ type: 'varchar', length: 180 }) name: string;

  /** Jauge facultative (null = sans limite, avertissements sans blocage). */
  @Column({ type: 'int', nullable: true }) capacity: number | null;

  /** Jours de circulation (dates ISO AAAA-MM-JJ) ; null ou vide = non précisé. */
  @Column({ type: 'text', array: true, nullable: true }) serviceDates: string[] | null;

  @Column({ type: 'text', nullable: true }) notes: string | null;

  @OneToMany(() => GatheringCarStop, (stop) => stop.car) stops: GatheringCarStop[];
  @OneToMany(() => GatheringCarAssignment, (assignment) => assignment.car)
  assignments: GatheringCarAssignment[];
  @OneToMany(() => GatheringCarPerson, (person) => person.car) persons: GatheringCarPerson[];

  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
