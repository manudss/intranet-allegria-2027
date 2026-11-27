import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Group } from './group.entity';
import { User } from './user.entity';
import { AssignmentPersonType } from './assignment-person-type.enum';

/**
 * Note logistique signée et datée, laissée sur une fiche par un responsable
 * (dans son périmètre) ou l'équipe nationale, sans modifier l'inscription.
 *
 * Le périmètre est figé à l'écriture (delegation) : la note reste dans la
 * délégation où elle a été écrite même si la personne change ensuite de
 * délégation, et la délégation de destination ne voit pas les notes des
 * autres délégations. Une note peut répondre à une autre (parent), ce qui
 * forme un fil par fiche et par délégation. L'auteur est figé à l'écriture
 * (authorName, authorRole) pour l'affichage même si son profil change.
 *
 * Contenu purement logistique : les données de santé restent dans le module
 * santé et ne sont jamais exposées ici.
 */
@Entity('person_notes')
export class PersonNote {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'enum', enum: AssignmentPersonType, enumName: 'assignment_person_type_enum' })
  personType: AssignmentPersonType;
  @Column({ type: 'int' }) personId: number;
  /** Délégation (périmètre) dans laquelle la note a été écrite : figée. */
  @ManyToOne(() => Group, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delegation_id' })
  delegation: Group;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_user_id' })
  author: User | null;
  /** Prénom et nom de l'auteur, figés à l'écriture (affichage de la signature). */
  @Column({ type: 'varchar' }) authorName: string;
  /** Fonction de l'auteur au moment de l'écriture (« Responsable de délégation »…). */
  @Column({ type: 'varchar', nullable: true }) authorRole: string | null;
  /** Réponse à une note existante (fil de discussion par fiche et délégation). */
  @ManyToOne(() => PersonNote, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent: PersonNote | null;
  @Column({ type: 'text' }) body: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
