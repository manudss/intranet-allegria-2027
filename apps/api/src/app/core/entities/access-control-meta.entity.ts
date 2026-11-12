import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Compteur de version global des affectations : chaque attribution,
 * remplacement ou révocation incrémente cette version dans la même
 * transaction. Les instantanés et deltas des scanners s'y réfèrent.
 */
@Entity({ name: 'access_control_meta' })
export class AccessControlMeta {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'int', default: 0 })
  version!: number;
}
