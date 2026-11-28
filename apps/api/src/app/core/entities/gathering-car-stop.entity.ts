import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GatheringCar } from './gathering-car.entity';

/** Arrêt ordonné d'un car du rassemblement : lieu en texte libre et heure de passage facultative. */
@Entity('gathering_car_stops')
export class GatheringCarStop {
  @PrimaryGeneratedColumn() id: number;

  @ManyToOne(() => GatheringCar, (car) => car.stops, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'car_id' }) car: GatheringCar;

  @Column({ type: 'int' }) orderIndex: number;

  @Column({ type: 'varchar', length: 200 }) label: string;

  /** Heure de passage au format HH:mm (texte, sans fuseau) ; null = non précisée. */
  @Column({ type: 'varchar', length: 5, nullable: true }) time: string | null;
}
