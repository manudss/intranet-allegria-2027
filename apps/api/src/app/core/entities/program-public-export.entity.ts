import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export interface PublicExportSequence {
  title: string;
  startTime: string;
  endTime: string;
  location: string;
}

/**
 * Instantané publié du programme public d'un jour (grands temps seulement).
 * Régénéré uniquement sur action explicite « Mettre à jour la liste publique »,
 * jamais en temps réel : c'est la liste statique lue par l'appli non connectée.
 */
@Entity({ name: 'program_public_exports' })
export class ProgramPublicExport {
  /** Jour de l'événement au format YYYY-MM-DD */
  @PrimaryColumn({ type: 'date' })
  eventDate!: string;

  @Column({ type: 'jsonb' })
  sequences!: PublicExportSequence[];

  @Column({ name: 'generated_by_user_id', type: 'int', nullable: true })
  generatedByUserId!: number | null;

  @Column({ type: 'timestamptz' })
  generatedAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
