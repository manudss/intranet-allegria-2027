import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GatheringCar } from './gathering-car.entity';
import { GatheringCarTarget } from './gathering-car-target.enum';
import { HostFamily } from './host-family.entity';
import { HostingGroup } from './hosting-group.entity';

/**
 * Affectation d'une cible (groupe d'hébergement ou hébergement collectif isolé) à
 * un car du rassemblement. Une cible est desservie par un seul car à la fois
 * (unicité partielle posée par la migration : un nul ne vaut pas une cible).
 */
@Entity('gathering_car_assignments')
export class GatheringCarAssignment {
  @PrimaryGeneratedColumn() id: number;

  @ManyToOne(() => GatheringCar, (car) => car.assignments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'car_id' }) car: GatheringCar;

  @Column({ type: 'enum', enum: GatheringCarTarget, enumName: 'gathering_car_target_enum' })
  targetType: GatheringCarTarget;

  @ManyToOne(() => HostingGroup, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hosting_group_id' }) hostingGroup: HostingGroup | null;

  @ManyToOne(() => HostFamily, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'host_family_id' }) hostFamily: HostFamily | null;

  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
