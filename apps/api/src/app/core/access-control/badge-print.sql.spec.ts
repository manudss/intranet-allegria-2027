import { PGlite } from '@electric-sql/pglite';
import { describe,it,expect } from 'vitest';
import { BadgePrintService } from './badge-print.service';
import { PersonType } from '../entities';
describe('Print selection actual PostgreSQL fields',()=>{
  it('filters name/type and joins only active assigned badges with mixed-case dates',async()=>{
    const pg=new PGlite();
    try {
      await pg.exec(`CREATE TABLE participants(id int,"firstName" text,"lastName" text,type text);
        CREATE TABLE access_badge_assignments(participant_id int,badge_id int,"endsAt" timestamptz);
        CREATE TABLE access_badges(id int,code text,status text);
        INSERT INTO participants VALUES (1,'Ada','QR-DEMO-Valide','JEUNE'),(2,'Emma','QR-DEMO-Benevole','BENEVOLE'),(3,'Louis','QR-DEMO-SansBadge','ANIMATEUR');
        INSERT INTO access_badges VALUES(7,'opaque','ASSIGNED'),(8,'old','LOST');
        INSERT INTO access_badge_assignments VALUES(1,7,NULL),(2,8,'2026-01-01');`);
      const db={query:async(sql:string,params:unknown[]) => (await pg.query(sql,params)).rows};
      const service=new BadgePrintService(db as never,{} as never);
      const all=await service.people({q:'QR-DEMO',limit:100});expect(all.total).toBe(3);expect(all.items.find((x:{id:number})=>x.id===1)).toMatchObject({code:'opaque',badgeId:7});expect(all.items.find((x:{id:number})=>x.id===2)).toMatchObject({code:null,badgeId:null});
      const young=await service.people({type:PersonType.JEUNE,q:'Ada'});expect(young.total).toBe(1);expect(young.items).toHaveLength(1);
      expect((await service.people({q:"' OR 1=1 --"})).total).toBe(0);
    } finally {await pg.close();}
  },20000);
});
