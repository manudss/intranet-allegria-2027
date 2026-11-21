import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { FamilySpace } from '@mej-allegria/shared';
@Entity({ name: 'registration_families' })
export class RegistrationFamily {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 254, unique: true }) email!: string;
  @Column('jsonb') dossier!: FamilySpace;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
