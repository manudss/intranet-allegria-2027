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
import { DocumentLink } from './document-link.entity';

@Entity({ name: 'document_categories' })
export class DocumentCategory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 80, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  label!: string;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId!: number | null;

  @ManyToOne(() => DocumentCategory, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent!: DocumentCategory | null;

  @OneToMany(() => DocumentCategory, (category) => category.parent)
  children!: DocumentCategory[];

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => DocumentLink, (link) => link.category)
  links!: DocumentLink[];
}
