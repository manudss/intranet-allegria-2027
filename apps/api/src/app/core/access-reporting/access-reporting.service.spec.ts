import { describe, it, expect, vi } from 'vitest';
import { AccessReportingService, validateReportRange } from './access-reporting.service';
const range={from:'2027-07-31T00:00:00Z',to:'2027-08-01T00:00:00Z'};
describe('Access reporting',()=>{
  it('requires bounded periods and paired distinct movement types',()=>{
    expect(()=>validateReportRange(range)).not.toThrow();
    for(const q of [{...range,to:range.from},{...range,to:'2028-01-01'}, {...range,entryTypeId:1},{...range,entryTypeId:1,exitTypeId:1}]) expect(()=>validateReportRange(q)).toThrow();
  });
  it('uses one consistent snapshot, counts people across zones only once, and binds filters',async()=>{
    const query=vi.fn().mockResolvedValueOnce([{accepted:5}]).mockResolvedValueOnce([{participantId:42,zoneId:1},{participantId:42,zoneId:2},{participantId:43,zoneId:1}]).mockResolvedValueOnce([{pendingReviews:2,lastReceivedAt:null}]);
    const transaction=vi.fn((_isolation, fn)=>fn({query}));
    const service=new AccessReportingService({transaction} as never);
    const result=await service.summary({...range,entryTypeId:1,exitTypeId:2,zoneId:4});
    expect(result.presence).toEqual({estimatedPresent:2,byZone:[{zoneId:1,present:2},{zoneId:2,present:1}]});
    expect(transaction).toHaveBeenCalledWith('REPEATABLE READ',expect.any(Function));
    expect(query.mock.calls[1][1]).toEqual([range.to,4,1,2]);
    expect(query.mock.calls[1][0]).not.toContain('>= $'); // carry-in before from
    expect(result.caveat).toContain('hors ligne');
  });
  it('does not infer custom entry and exit types from a label',async()=>{
    const query=vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{pendingReviews:0}]);
    const service=new AccessReportingService({transaction:(_i:unknown,fn: (m:unknown)=>unknown)=>fn({query})} as never);
    expect((await service.summary(range)).presence).toBeNull(); expect(query).toHaveBeenCalledTimes(2);
  });
  it('returns a safe paginated projection without QR codes',async()=>{
    const query=vi.fn().mockResolvedValue([{id:1,totalCount:12,firstName:'Ada'}]);
    const service=new AccessReportingService({query} as never);
    expect(await service.reviews({limit:10,offset:0,zoneId:4})).toEqual({items:[{id:1,firstName:'Ada'}],total:12});
    expect(query.mock.calls[0][0]).not.toContain('e.code');expect(query.mock.calls[0][1]).toEqual([4,10,0]);
  });
  it('closes with an immutable actor/note record, retries idempotently and never rewrites the event',async()=>{
    const record={eventId:1,reviewerId:2,note:'Verified with scanner'};
    const eventRepo={findOne:vi.fn().mockResolvedValue({id:1,verdict:'DUPLICATE',needsReview:false})};
    const reviewRepo={findOneBy:vi.fn().mockResolvedValue(null),create:vi.fn(x=>x),save:vi.fn().mockResolvedValue(record)};
    const manager={getRepository:vi.fn((c: {name:string})=>c.name==='AccessScanEvent'?eventRepo:reviewRepo)};
    const service=new AccessReportingService({transaction:(fn:(m:unknown)=>unknown)=>fn(manager)} as never);
    expect(await service.closeReview(1,2,record.note)).toEqual(record);expect(reviewRepo.save).toHaveBeenCalledTimes(1);
    reviewRepo.findOneBy.mockResolvedValue(record);expect(await service.closeReview(1,2,record.note)).toEqual(record);expect(reviewRepo.save).toHaveBeenCalledTimes(1);
    await expect(service.closeReview(1,3,'Different reviewer')).rejects.toThrow('déjà close');
    expect(eventRepo.findOne).toHaveBeenCalledWith({where:{id:1},lock:{mode:'pessimistic_write'}});
  });
  it('rejects an ordinary accepted scan or a blank note',async()=>{
    const repo={findOne:vi.fn().mockResolvedValue({id:1,needsReview:false,verdict:'ACCEPTED'})};
    const service=new AccessReportingService({transaction:(fn:(m:unknown)=>unknown)=>fn({getRepository:()=>repo})} as never);
    await expect(service.closeReview(1,2,'Validated')).rejects.toThrow('ne nécessite pas');
    await expect(service.closeReview(1,2,'  ')).rejects.toThrow('motif');
  });
});
