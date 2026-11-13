import assert from 'node:assert/strict';
const base=process.env.API_URL??'http://localhost:3000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname)&&process.env.QR_SMOKE_ALLOW_MUTATION==='yes','Loopback seed database only');
async function call(method,path,token,body,status=200){const r=await fetch(`${base}/api${path}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.ok(r.status===status||(status===200&&r.status===201),`${method} ${path}: ${r.status} ${JSON.stringify(data)}`);return data;}
const login=async email=>(await call('POST','/auth/login',null,{email,password:'demo-only-not-a-secret'})).accessToken;
const manager=await login('qr.manager@allegria.local'),scanner=await login('qr.scanner.a@allegria.local'),admin=await login('admin@allegria.local');
const people=await call('GET','/access-control/printing/participants?q=QR-DEMO&limit=100',manager);assert.equal(people.items.length,12);assert.ok(people.items.every(p=>Object.keys(p).every(k=>['id','firstName','lastName','type','badgeId','code'].includes(k))));
const noBadge=people.items.find(p=>p.firstName==='SansBadge'),valid=people.items.find(p=>p.firstName==='Jeune');assert.equal(noBadge.badgeId,null);assert.ok(valid.code);
const prepare=()=>call('POST','/access-control/printing/participants/prepare',manager,{participantIds:[noBadge.id,valid.id]});
const results=await Promise.all([prepare(),prepare()]);assert.equal(results.reduce((sum,r)=>sum+r.created,0),1);assert.equal(results[0].items.find(p=>p.id===valid.id).code,valid.code);assert.equal(results[0].items.find(p=>p.id===noBadge.id).code,results[1].items.find(p=>p.id===noBadge.id).code);
await call('GET','/access-control/printing/participants',scanner,undefined,403);
const points=await call('GET','/access-control/config/points',admin);const meal=points.find(p=>p.scanType.code==='REPAS');const gate=points.find(p=>p.name==='Porte A');
for(const email of ['qr.scanner.a@allegria.local','qr.scanner.b@allegria.local','qr.zone@allegria.local']){const token=await login(email);await call('POST','/access-control/scan/sessions',token,{zoneId:meal.zoneId});if(email.includes('zone@'))await call('POST','/access-control/scan/sessions',token,{zoneId:gate.zoneId},403);}
for(const email of ['qr.expired@allegria.local','qr.revoked@allegria.local','qr.no-grant@allegria.local','qr.no-role@allegria.local']){const token=await login(email);await call('POST','/access-control/scan/sessions',token,{zoneId:meal.zoneId},403);}
const review=await call('GET','/access-control/reporting/reviews?limit=100',manager);assert.ok(review.items.some(r=>r.verdict==='DUPLICATE'));assert.ok(review.items.some(r=>r.needsReview));
console.log('QR testkit: seed fixtures, configured role/grant cases, minimal print projection, concurrent create-or-reuse: PASS');
