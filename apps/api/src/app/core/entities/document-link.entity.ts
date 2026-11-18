import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentCategory } from './document-category.entity';
import { DocumentFileType } from './document-file-type.enum';
import { DocumentLinkTeam } from './document-link-team.entity';
import { DocumentLinkVisibility } from './document-link-visibility.enum';
import { User } from './user.entity';

@Entity({ name: 'document_links' })
export class DocumentLink {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 1024 })
  url!: string;

  @Column({ type: 'enum', enum: DocumentFileType, default: DocumentFileType.OTHER })
  fileType!: DocumentFileType;

  @Column({ name: 'category_id', type: 'int', nullable: true })
  categoryId!: number | null;

  @ManyToOne(() => DocumentCategory, (category) => category.links, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category!: DocumentCategory | null;

  @Column({ type: 'enum', enum: DocumentLinkVisibility, default: DocumentLinkVisibility.ALL })
  visibility!: DocumentLinkVisibility;

  @Column({ name: 'created_by_user_id', type: 'int', nullable: true })
  createdByUserId!: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy!: User | null;

  @Column({ name: 'updated_by_user_id', type: 'int', nullable: true })
  updatedByUserId!: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedBy!: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => DocumentLinkTeam, (linkTeam) => linkTeam.documentLink)
  teamRestrictions!: DocumentLinkTeam[];
}
