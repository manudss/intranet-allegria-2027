import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { AccessScanEvent } from '../entities/access-scan-event.entity';
import { User } from '../entities/user.entity';
/** Immutable closure record. The original event and verdict never change. */
@Entity('access_scan_reviews')
export class AccessScanReview {
  @PrimaryColumn({name:'event_id', type:'int'}) eventId!: number;
  @ManyToOne(() => AccessScanEvent, {onDelete:'RESTRICT'}) @JoinColumn({name:'event_id'}) event!: AccessScanEvent;
  @Column({name:'reviewer_id', type:'int'}) reviewerId!: number;
  @ManyToOne(() => User, {onDelete:'RESTRICT'}) @JoinColumn({name:'reviewer_id'}) reviewer!: User;
  @Column({type:'varchar',length:1000}) note!: string;
  @CreateDateColumn({name:'reviewed_at',type:'timestamptz'}) reviewedAt!: Date;
}
