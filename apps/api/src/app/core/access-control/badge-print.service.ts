import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource, IsNull } from 'typeorm';
import { AccessAuditAction, AccessBadge, AccessBadgeAssignment, AccessBadgeStatus, Participant, PersonType } from '../entities';
import { AccessAuditService } from './access-audit.service';
export interface PrintPerson { id:number;firstName:string;lastName:string;type:PersonType;badgeId:number|null;code:string|null }
@Injectable()
export class BadgePrintService {
  constructor(private readonly db:DataSource,private readonly audit:AccessAuditService) {}
  async people(q:{q?:string;type?:PersonType;limit?:number;offset?:number}) {
    const qb=this.db.getRepository(Participant).createQueryBuilder('p')
      .leftJoin(AccessBadgeAssignment,'a','a.participant_id=p.id AND a.endsAt IS NULL')
      .leftJoin(AccessBadge,'b','b.id=a.badge_id AND b.status=:assigned',{assigned:AccessBadgeStatus.ASSIGNED})
      .select(['p.id AS id','p.firstName AS "firstName"','p.lastName AS "lastName"','p.type AS type','b.id AS "badgeId"','b.code AS code'])
      .orderBy('p.lastName','ASC').addOrderBy('p.firstName','ASC').addOrderBy('p.id','ASC');
    if(q.type)qb.andWhere('p.type=:type',{type:q.type});
    if(q.q?.trim())qb.andWhere("concat_ws(' ',p.firstName,p.lastName) ILIKE :q",{q:`%${q.q.trim()}%`});
    const total=await qb.getCount();const items=await qb.limit(q.limit??50).offset(q.offset??0).getRawMany<PrintPerson>();return {items,total};
  }
  async prepare(participantIds:number[],actorId:number) {
    const ids=[...new Set(participantIds)].sort((a,b)=>a-b);
    if(!ids.length||ids.length>100)throw new BadRequestException('Sélectionnez de 1 à 100 personnes');
    return this.db.transaction(async manager=>{
      const result:(PrintPerson&{created:boolean})[]=[];
      for(const id of ids) {
        // Serialise competing print preparations for the same person.
        const person=await manager.getRepository(Participant).findOne({where:{id},lock:{mode:'pessimistic_write'}});
        if(!person)throw new BadRequestException(`Personne ${id} introuvable`);
        let assignment=await manager.getRepository(AccessBadgeAssignment).findOne({where:{participantId:id,endsAt:IsNull()}});
        let badge=assignment?await manager.getRepository(AccessBadge).findOneBy({id:assignment.badgeId}):null;
        const created=!assignment;
        if(assignment && badge?.status!==AccessBadgeStatus.ASSIGNED)throw new ConflictException(`Badge actif incohérent pour ${id}. Vérifiez son historique.`);
        if(!assignment) {
          badge=await manager.getRepository(AccessBadge).save(manager.getRepository(AccessBadge).create({code:randomBytes(16).toString('hex'),lot:'IMPRESSION-PARTICIPANTS',status:AccessBadgeStatus.ASSIGNED}));
          const [meta]=await manager.query('UPDATE access_control_meta SET version=version+1 WHERE id=1 RETURNING version');
          if(!meta)throw new ConflictException('Configuration contrôle accès absente');
          assignment=await manager.getRepository(AccessBadgeAssignment).save(manager.getRepository(AccessBadgeAssignment).create({participantId:id,badgeId:badge.id,version:1,metaCreatedVersion:meta.version,createdByUserId:actorId,reason:'Création pour impression nominative'}));
          await this.audit.record({userId:actorId,action:AccessAuditAction.BADGE_ASSIGNED,entityType:'access_badge_assignments',entityId:assignment.id,details:{participantId:id,badgeId:badge.id,source:'print-preparation'}},manager);
        }
        if(!badge)throw new ConflictException('Badge manquant');
        result.push({id,firstName:person.firstName,lastName:person.lastName,type:person.type,badgeId:badge.id,code:badge.code,created});
      }
      return {items:result,created:result.filter(p=>p.created).length,reused:result.filter(p=>!p.created).length};
    });
  }
}
