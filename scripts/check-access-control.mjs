// Integration test against the ephemeral CI database and seed accounts only.
// Never run against a deployment. All fixture people/badges come from the seed.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base=process.env.API_URL ?? 'http://localhost:3000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname) && process.env.QR_SMOKE_ALLOW_MUTATION==='yes', 'Requires loopback API and QR_SMOKE_ALLOW_MUTATION=yes');
async function request(method,path,token,body,expected=200) {
  const res=await fetch(`${base}/api${path}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await res.json(); assert.ok(res.status===expected || (expected===200 && res.status===201), `${method} ${path}: ${res.status} ${JSON.stringify(data)}`);return data;
}
async function login(email) {return (await request('POST','/auth/login',null,{email,password:'demo-only-not-a-secret'})).accessToken;}
const admin=await login('admin@allegria.local'), scanner=await login('logistic.1@allegria.local'), health=await login('sante@allegria.local');
const me=await request('GET','/users/me',admin), other=await request('GET','/users/me',scanner);
for(const user of [me,other]) await request('POST','/access-control/scanner-grants',admin,{userId:user.id});
const grants=await request('GET','/access-control/scanner-grants',admin);assert.ok(!JSON.stringify(grants).includes('passwordHash'));
await request('GET','/access-control/reporting/reviews',null,undefined,401);await request('GET','/access-control/reporting/reviews',health,undefined,403);
const points=await request('GET','/access-control/config/points',admin), meal=points.find(p=>p.scanType.code==='REPAS');assert.ok(meal,'seed has a meal point');
const start=token=>request('POST','/access-control/scan/sessions',token,{zoneId:meal.zoneId});
const a=await start(admin), b=await start(scanner), holder=a.snapshot.find(s=>s.personType==='JEUNE');assert.ok(holder);
const historyBadge=await request('GET',`/access-control/badges/by-code/${holder.code}`,admin);const participantId=historyBadge.assignments.find(x=>!x.endsAt).participantId;
const available=(await request('GET','/access-control/badges?status=AVAILABLE&limit=1',admin)).items[0];assert.ok(available);
const makeScan=(code,assignmentId,point=meal)=>({clientEventId:randomUUID(),code,assignmentId,tableVersion:a.snapshotVersion,pointId:point.id,serviceKey:point.serviceKey,occurredAtLocal:new Date().toISOString()});
const upload=(session,token,scans)=>request('POST',`/access-control/scan/sessions/${session.sessionId}/scans`,token,{scans});
const first=makeScan(holder.code,holder.assignmentId);assert.equal((await upload(a,admin,[first]))[0].verdict,'ACCEPTED');assert.equal((await upload(a,admin,[first]))[0].verdict,'ACCEPTED');
const op=randomUUID();const replacement=await request('POST','/access-control/badges/replace',admin,{participantId,newBadgeCode:available.code,operationId:op,reason:'CI lost-badge scenario'});assert.equal((await request('POST','/access-control/badges/replace',admin,{participantId,newBadgeCode:available.code,operationId:op})).id,replacement.id);
// Scanner B has not downloaded the revocation and uploads its old assignment.
const late=makeScan(holder.code,holder.assignmentId);assert.equal((await upload(b,scanner,[late]))[0].verdict,'REJECTED_EXPIRED_ASSIGNMENT');
assert.equal((await upload(a,admin,[makeScan(available.code,replacement.id)]))[0].verdict,'DUPLICATE');
const delta=await request('GET',`/access-control/scan/sessions/${b.sessionId}/delta?since=${b.snapshotVersion}`,scanner);assert.ok(delta.revokedAssignmentIds.includes(holder.assignmentId));
// A second service with two concurrent uploads: exactly one accepted per person.
const parallelPoint=await request('POST','/access-control/config/points',admin,{zoneId:meal.zoneId,scanTypeId:meal.scanTypeId,name:'CI concurrent meal',serviceKey:`ci-${randomUUID()}`});
const raced=await Promise.all([upload(a,admin,[makeScan(available.code,replacement.id,parallelPoint)]),upload(b,scanner,[makeScan(available.code,replacement.id,parallelPoint)])]);assert.deepEqual(raced.flat().map(x=>x.verdict).sort(),['ACCEPTED','DUPLICATE']);
const now=Date.now();const query=new URLSearchParams({from:new Date(now-86400000).toISOString(),to:new Date(now+60000).toISOString()});const summary=await request('GET',`/access-control/reporting/summary?${query}`,admin);assert.ok(summary.pendingReviews>=3);assert.ok(summary.counts.some(c=>c.duplicates>0));
const reviewList=await request('GET','/access-control/reporting/reviews?limit=100',admin);const review=reviewList.items.find(r=>r.verdict==='REJECTED_EXPIRED_ASSIGNMENT');assert.ok(review);assert.ok(!('code' in review));
const closed=await request('POST',`/access-control/reporting/reviews/${review.id}/close`,admin,{note:'CI: stale offline badge confirmed'});assert.equal(closed.reviewerId,me.id);
assert.ok(!(await request('GET','/access-control/reporting/reviews?limit=100',admin)).items.some(r=>r.id===review.id));
assert.equal((await upload(b,scanner,[late]))[0].verdict,'REJECTED_EXPIRED_ASSIGNMENT');
await request('POST',`/access-control/scan/sessions/${a.sessionId}/close`,admin,{});await request('POST',`/access-control/scan/sessions/${b.sessionId}/close`,scanner,{});
console.log('QR integration: idempotence, lost badge with stale second scanner, person-based meal continuity, delta, concurrent duplicate locks, reporting RBAC, immutable review closure: PASS');
