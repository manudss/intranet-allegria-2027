import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { AccessBadge, AccessBadgeAssignment, AccessBadgeStatus, AccessScanEvent, AccessScanPoint, AccessScanSession, AccessScanType, AccessScanVerdict, AccessScannerGrant, AccessZone, Participant, PersonType, Role, User, UserRole, Volunteer, MejAgeGroup } from '../../app/core/entities';
import { AccessScanReview } from '../../app/core/access-reporting/access-scan-review.entity';

/** Every invocation is part of the existing full fictitious-data reseed. */
export const QR_TEST_ACCOUNTS = [
  {email:'qr.manager@allegria.local',roles:['BADGE_MANAGER'],scope:'none'},
  {email:'qr.scanner.a@allegria.local',roles:['SCANNER'],scope:'all'},
  {email:'qr.scanner.b@allegria.local',roles:['SCANNER'],scope:'all'},
  {email:'qr.zone@allegria.local',roles:['SCANNER'],scope:'meal'},
  {email:'qr.expired@allegria.local',roles:['SCANNER'],scope:'expired'},
  {email:'qr.revoked@allegria.local',roles:['SCANNER'],scope:'revoked'},
  {email:'qr.no-grant@allegria.local',roles:['SCANNER'],scope:'none'},
  {email:'qr.no-role@allegria.local',roles:[],scope:'none'},
] as const;
export function qrTestDates(now: Date) {
  const at=(minutes:number)=>new Date(now.getTime()+minutes*60_000);
  return {now,started:at(-60),expired:at(-1),activeUntil:at(30),sessionUntil:at(660),grantFrom:at(-1440),grantUntil:at(30*1440),replaced:at(-20)};
}
export async function seedAccessTestkit(ds:DataSource, admin:User, passwordHash:string, now=new Date()) {
  const d=qrTestDates(now),repo=<T extends object>(entity:new()=>T)=>ds.getRepository(entity);
  const zones=await repo(AccessZone).find(),types=await repo(AccessScanType).find(),points=await repo(AccessScanPoint).find();
  const zone=zones.find(z=>z.name==='Restauration')!,meal=points.find(p=>p.zoneId===zone.id)!;
  const entry=points.find(p=>p.name==='Porte A')!,exit=points.find(p=>p.name==='Porte A (sortie)')!;
  const users:User[]=[];
  for(const account of QR_TEST_ACCOUNTS) {
    const user=await repo(User).save(repo(User).create({email:account.email,passwordHash,isActive:true}));users.push(user);
    for(const code of account.roles) {const role=await repo(Role).findOneByOrFail({code});await repo(UserRole).save({userId:user.id,roleId:role.id});}
    if(account.scope!=='none') await repo(AccessScannerGrant).save(repo(AccessScannerGrant).create({userId:user.id,zoneId:account.scope==='meal'?zone.id:null,startsAt:d.grantFrom,endsAt:account.scope==='expired'||account.scope==='revoked'?d.expired:d.grantUntil,createdByUserId:admin.id}));
  }
  const fixtures=[
    ['Jeune','Valide',PersonType.JEUNE],['Animateur','Valide',PersonType.ANIMATEUR],['Benevole','Valide',PersonType.BENEVOLE],
    ['SansBadge','AAttribuer',PersonType.JEUNE],['Repas','DejaServi',PersonType.JEUNE],['Badge','Remplace',PersonType.JEUNE],
    ['Badge','Revoque',PersonType.BENEVOLE],['Affectation','Expiree',PersonType.ANIMATEUR],['Presence','Sorti',PersonType.JEUNE],
    ['Presence','Reentre',PersonType.JEUNE],['Doublon','AVerifier',PersonType.JEUNE],['Tardif','AVerifier',PersonType.JEUNE],
  ] as const;
  const people:Participant[]=[],assignments:AccessBadgeAssignment[]=[];
  const badges=await repo(AccessBadge).save(Array.from({length:24},()=>repo(AccessBadge).create({code:randomBytes(16).toString('hex'),lot:'QR-TESTKIT',status:AccessBadgeStatus.AVAILABLE})));
  for(const [i,[first,last,type]] of fixtures.entries()) {
    const person=await repo(Participant).save(repo(Participant).create({firstName:first,lastName:`QR-DEMO-${last}`,type,mejAgeGroup:type===PersonType.BENEVOLE?null:i%2?MejAgeGroup.ES:MejAgeGroup.TA,dateOfBirth:type===PersonType.JEUNE?'2013-06-15':null}));people.push(person);
    if(i===3)continue;
    const ended=[5,6,7].includes(i),status=i===5?AccessBadgeStatus.LOST:i===6?AccessBadgeStatus.REVOKED:AccessBadgeStatus.ASSIGNED;
    const a=await repo(AccessBadgeAssignment).save(repo(AccessBadgeAssignment).create({participantId:person.id,badgeId:badges[i].id,startsAt:d.started,endsAt:ended?d.replaced:null,version:1,metaCreatedVersion:1,metaClosedVersion:ended?2:null,createdByUserId:admin.id,reason:'QR testkit: '+last}));assignments[i]=a;
    await repo(AccessBadge).update(badges[i].id,{status});
    if(i===5) {const replacement=await repo(AccessBadgeAssignment).save(repo(AccessBadgeAssignment).create({participantId:person.id,badgeId:badges[12].id,startsAt:d.replaced,version:1,metaCreatedVersion:2,createdByUserId:admin.id,reason:'QR testkit: remplacement après repas'}));await repo(AccessBadge).update(badges[12].id,{status:AccessBadgeStatus.ASSIGNED});void replacement;}
  }
  // A real volunteer without any participant projection exercises the complete selector.
  await repo(Volunteer).save(repo(Volunteer).create({firstName:'BenevoleSansFiche',lastName:'QR-PRINT-DEMO'}));
  await ds.query('UPDATE access_control_meta SET version=2 WHERE id=1');
  const makeSession=(user:User,expired=false)=>repo(AccessScanSession).save(repo(AccessScanSession).create({userId:user.id,zoneId:zone.id,startedAt:d.started,expiresAt:expired?d.expired:d.sessionUntil,keyExpiresAt:expired?d.expired:d.activeUntil,snapshotVersion:1,sessionKey:randomBytes(32).toString('hex')}));
  const a=await makeSession(users[1]),b=await makeSession(users[2]),expired=await makeSession(users[1],true);
  const add=async(i:number,point:AccessScanPoint,verdict:AccessScanVerdict,minutes:number,needsReview=false,session=a)=>repo(AccessScanEvent).save(repo(AccessScanEvent).create({sessionId:session.id,assignmentId:assignments[i].id,participantId:people[i].id,badgeId:assignments[i].badgeId,code:badges[i].code,pointId:point.id,scanTypeId:point.scanTypeId,serviceKey:point.serviceKey,clientEventId:`qr-seed-${randomBytes(12).toString('hex')}`,tableVersion:1,occurredAtLocal:new Date(now.getTime()+minutes*60_000),receivedAt:now,verdict,needsReview}));
  await add(4,meal,AccessScanVerdict.ACCEPTED,-40);
  await add(5,meal,AccessScanVerdict.ACCEPTED,-40); // meal before lost badge replacement
  await add(5,meal,AccessScanVerdict.REJECTED_EXPIRED_ASSIGNMENT,-10,true,b);
  await add(8,entry,AccessScanVerdict.ACCEPTED,-50);await add(8,exit,AccessScanVerdict.ACCEPTED,-30);
  await add(9,entry,AccessScanVerdict.ACCEPTED,-50);await add(9,exit,AccessScanVerdict.ACCEPTED,-30);await add(9,entry,AccessScanVerdict.ACCEPTED,-10);
  await add(10,meal,AccessScanVerdict.ACCEPTED,-30);await add(10,meal,AccessScanVerdict.DUPLICATE,-29,false,b);
  const closed=await add(10,meal,AccessScanVerdict.DUPLICATE,-28,false,b);await repo(AccessScanReview).save({eventId:closed.id,reviewerId:admin.id,note:'DEMO : vérification déjà close, verdict conservé.'});
  await add(11,meal,AccessScanVerdict.ACCEPTED,-30,true,expired);
  // Additional points expose configured daily and bus modes as well as inactive controls.
  await repo(AccessScanPoint).save([
    repo(AccessScanPoint).create({zoneId:entry.zoneId,scanTypeId:types.find(t=>t.code==='APPEL')!.id,name:'QR testkit - Appel quotidien'}),
    repo(AccessScanPoint).create({zoneId:entry.zoneId,scanTypeId:types.find(t=>t.code==='BUS')!.id,name:'QR testkit - Bus aller',serviceKey:'test-bus-aller'}),
    repo(AccessScanPoint).create({zoneId:entry.zoneId,scanTypeId:entry.scanTypeId,name:'QR testkit - Point inactif',active:false}),
  ]);
  console.log('QR testkit : 12 personnes QR-DEMO, lot QR-TESTKIT, 8 comptes qr.* prêts. Habilitations actives 30 jours à partir du seed.');
}
