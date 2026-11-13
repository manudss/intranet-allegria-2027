import { describe,it,expect,vi } from 'vitest';
import { BadgePrintService } from './badge-print.service';
import { AccessBadge,AccessBadgeAssignment,Participant,Volunteer } from '../entities';
function setup(active=false) {
  const person={id:42,firstName:'Ada',lastName:'Test',type:'JEUNE'};
  const people={findOne:vi.fn().mockResolvedValue(person)};
  const volunteers={findOne:vi.fn().mockResolvedValue({id:5,firstName:'Emma',lastName:'Demo'})};
  const badges={findOneBy:vi.fn().mockResolvedValue({id:7,status:'ASSIGNED',code:'original'}),create:vi.fn(x=>x),save:vi.fn(x=>Promise.resolve({id:8,...x}))};
  const assignments={findOne:vi.fn().mockResolvedValue(active?{id:10,participantId:42,badgeId:7}:null),create:vi.fn(x=>x),save:vi.fn(x=>Promise.resolve({id:11,...x}))};
  const query=vi.fn().mockResolvedValue([{version:2}]);
  const manager={getRepository:(entity:unknown)=>entity===Volunteer?volunteers:entity===Participant?people:entity===AccessBadge?badges:entity===AccessBadgeAssignment?assignments:null,query};
  const audit={record:vi.fn()};const db={transaction:vi.fn(fn=>fn(manager))};
  return {service:new BadgePrintService(db as never,audit as never),people,badges,assignments,audit,query,volunteers};
}
describe('BadgePrintService',()=>{
  it('reuses the active badge without any assignment mutation',async()=>{const {service,badges,assignments,audit}=setup(true);const res=await service.prepare([42],1);expect(res).toMatchObject({created:0,reused:1,items:[{id:42,code:'original',created:false}]});expect(badges.save).not.toHaveBeenCalled();expect(assignments.save).not.toHaveBeenCalled();expect(audit.record).not.toHaveBeenCalled();});
  it('creates an opaque badge and audited assignment under person lock',async()=>{const {service,people,badges,assignments,audit}=setup();const res=await service.prepare([42,42],1);expect(res.created).toBe(1);expect(res.items[0].code).toMatch(/^[a-f0-9]{32}$/);expect(res.items[0].code).not.toContain('Ada');expect(people.findOne).toHaveBeenCalledWith({where:{id:42},lock:{mode:'pessimistic_write'}});expect(badges.save).toHaveBeenCalledTimes(1);expect(assignments.save).toHaveBeenCalledWith(expect.objectContaining({participantId:42,createdByUserId:1,metaCreatedVersion:2}));expect(audit.record).toHaveBeenCalledTimes(1);});
  it('fails closed on missing or inconsistent people and badges',async()=>{const {service,people,badges}=setup(true);people.findOne.mockResolvedValueOnce(null);await expect(service.prepare([42],1)).rejects.toThrow('introuvable');badges.findOneBy.mockResolvedValueOnce({id:7,status:'LOST',code:'old'});await expect(service.prepare([42],1)).rejects.toThrow('incohérent');});
  it('materialises volunteer projections only on preparation and deduplicates mixed selections', async()=>{
    const {service,volunteers,people,query,badges}=setup();
    people.findOne.mockResolvedValue({id:42,firstName:'Emma',lastName:'Demo',type:'BENEVOLE'});
    const result=await service.prepare([42],1,[5,5]);
    expect(result.items).toHaveLength(1);expect(result.items[0]).toMatchObject({id:42,volunteerId:5,lastName:'Demo'});
    expect(volunteers.findOne).toHaveBeenCalledWith({where:{id:5},lock:{mode:'pessimistic_write'}});
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (volunteer_id)'),['Emma','Demo',5]);
    expect(badges.save).toHaveBeenCalledOnce();
  });
  it('does not expose a minor surname on preparation',async()=>{expect((await setup().service.prepare([42],1)).items[0].lastName).toBeNull();});
  it('refuses missing volunteers and oversized combined pools',async()=>{
    const {service,volunteers}=setup();volunteers.findOne.mockResolvedValue(null);
    await expect(service.prepare([],1,[5])).rejects.toThrow('introuvable');
    await expect(service.prepare(Array.from({length:60},(_,i)=>i+1),1,Array.from({length:41},(_,i)=>i+1))).rejects.toThrow('100');
  });
  it('bounds selection and never replaces a badge',async()=>{const {service}=setup();await expect(service.prepare([],1)).rejects.toThrow();await expect(service.prepare(Array.from({length:101},(_,i)=>i+1),1)).rejects.toThrow();});
});
