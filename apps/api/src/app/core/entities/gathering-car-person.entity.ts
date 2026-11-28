import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { GatheringCar } from './gathering-car.entity';
import { GatheringCarPersonKind } from './gathering-car-person-kind.enum';
import { Participant } from './participant.entity';

/**
 * Exception individuelle sur un car : une personne ajoutée au car alors que son
 * lieu d'hébergement n'y est pas rattaché (ADDED), ou retirée du car alors que
 * son lieu y est rattaché (REMOVED). Les personnes restent rattachées à leur
 * délégation pour les trajets aller/retour : rien de commun.
 */
@Entity('gathering_car_persons')
@Unique('one_row_per_car_and_participant', ['car', 'participant'])
export class GatheringCarPerson {
  @PrimaryGeneratedColumn() id: number;

  @ManyToOne(() => GatheringCar, (car) => car.persons, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'car_id' }) car: GatheringCar;

  @ManyToOne(() => Participant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participant_id' }) participant: Participant;

  @Column({ type: 'enum', enum: GatheringCarPersonKind, enumName: 'gathering_car_person_kind_enum' })
  kind: GatheringCarPersonKind;

  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
