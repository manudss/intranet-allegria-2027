import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Place } from './place.entity';

/**
 * Salle d'un lieu : un simple nom, sans adresse ni autre information (tout reste porté par
 * le lieu). Sert à affecter un créneau, un groupe ou une mission à une salle précise.
 * Affichée « Nom du lieu · Nom de la salle ».
 */
@Entity({ name: 'place_rooms' })
@Index('UQ_place_rooms_place_name', ['placeId', 'name'], { unique: true })
export class PlaceRoom {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'place_id', type: 'int' })
  placeId!: number;

  @ManyToOne(() => Place, (place) => place.rooms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'place_id' })
  place!: Place;

  @Column({ type: 'varchar', length: 120 })
  name!: string;
}
