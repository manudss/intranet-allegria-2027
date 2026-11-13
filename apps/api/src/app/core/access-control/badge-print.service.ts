import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource, IsNull } from 'typeorm';
import { AccessAuditAction, AccessBadge, AccessBadgeAssignment, AccessBadgeStatus, Participant, PersonType, Volunteer } from '../entities';
import { AccessAuditService } from './access-audit.service';
export interface PrintPerson { id:number;firstName:string;lastName:string|null;type:PersonType;badgeId:number|null;code:string|null }
@Injectable()
export class BadgePrintService {
  constructor(private readonly db:DataSource,private readonly audit:AccessAuditService) {}
  async people(q:{q?:string;type?:PersonType;limit?:number;offset?:number}) {
    const params=[q.type??null,q.q?.trim()?`%${q.q.trim()}%`:null,q.limit??50,q.offset??0];
    const where=`WHERE ($1::text IS NULL OR p.type::text=$1) AND ($2::text IS NULL OR concat_ws(' ',p."firstName",p."lastName") ILIKE $2)`;
    const [count]=await this.db.query(`SELECT count(*)::int AS total FROM participants p ${where}`,params.slice(0,2));
    const items=await this.db.query(`SELECT p.id,p."firstName",CASE WHEN p.type='JEUNE' THEN NULL ELSE p."lastName" END AS "lastName",p.type,b.id AS "badgeId",b.code
      FROM participants p LEFT JOIN access_badge_assignments a ON a.participant_id=p.id AND a."endsAt" IS NULL
      LEFT JOIN access_badges b ON b.id=a.badge_id AND b.status='ASSIGNED'
      ${where} ORDER BY p."lastName",p."firstName",p.id LIMIT $3 OFFSET $4`,params);
    return {items,total:count.total};
  }

  async prepare(participantIds:number[],actorId:number,volunteerIds:number[] = []) {
    const ids=[...new Set(participantIds)].sort((a,b)=>a-b);
    const volunteers=[...new Set(volunteerIds)].sort((a,b)=>a-b);
    if(!ids.length&&!volunteers.length||ids.length+volunteers.length>100)throw new BadRequestException('Sélectionnez de 1 à 100 personnes');
    return this.db.transaction(async manager=>{
      const volunteerByPerson = new Map<number, number>();
      for (const volunteerId of volunteers) {
        const volunteer = await manager.getRepository(Volunteer).findOne({where:{id:volunteerId},lock:{mode:'pessimistic_write'}});
        if (!volunteer) throw new BadRequestException(`Bénévole ${volunteerId} introuvable`);
        // The existing unique index prevents duplicate projections, including cross-workflow races.
        // A projection is only materialised on explicit generation, never during selection.
        await manager.query(`INSERT INTO participants ("firstName","lastName",type,volunteer_id)
          VALUES ($1,$2,'BENEVOLE',$3) ON CONFLICT (volunteer_id) WHERE volunteer_id IS NOT NULL DO NOTHING`,[volunteer.firstName,volunteer.lastName,volunteerId]);
        const person = await manager.getRepository(Participant).findOne({where:{volunteer:{id:volunteerId}}});
        if (!person) throw new ConflictException('Projection bénévole introuvable');
        volunteerByPerson.set(person.id,volunteerId);
        if (!ids.includes(person.id)) ids.push(person.id);
      }
      ids.sort((a,b)=>a-b);
      const result:(PrintPerson&{created:boolean;volunteerId?:number})[]=[];
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
        result.push({id,firstName:person.firstName,lastName:person.type===PersonType.JEUNE?null:person.lastName,type:person.type,badgeId:badge.id,code:badge.code,created,...(volunteerByPerson.has(id)?{volunteerId:volunteerByPerson.get(id)}:{})});
      }
      return {items:result,created:result.filter(p=>p.created).length,reused:result.filter(p=>!p.created).length};
    });
  }
}
