// Synthetic browser fixtures only. No credential here is valid for authentication.
export const targetId='49e4eac3-00a9-4de4-81dc-f4686fb677cc',integrationId='29e4eac3-00a9-4de4-81dc-f4686fb677cc';
export const target={id:targetId,origin:'https://atelier.example',method:'HTTPS_FILE',state:'VERIFIED',verifiedAt:'2026-10-18T12:00:00Z',validUntil:'2026-11-18T12:00:00Z',nextCheckAt:'2026-10-20T12:00:00Z',challengeExpiresAt:null};
export const key={id:'1'.repeat(32),integrationId,slot:1,name:'Production · Atelier',scopes:['audits:write','results:read','usage:read'],targets:[{id:targetId,origin:target.origin,authorizationEpoch:1}],createdAt:'2026-10-18T12:00:00Z',expiresAt:'2027-10-18T12:00:00Z',lastUsedAt:'2026-10-19T08:30:00Z',revokedAt:null,overlapUntil:null};
export const keys={items:[key],integrations:[{id:integrationId,slot:1,canReplace:false}],nextCursor:null};
export const status={enabled:true,eligible:true,offer:'PREMIUM',validUntil:'2026-11-18T12:00:00Z',limits:{monthlyAnalysesPerKey:30,activeKeys:3,verifiedTargets:null,concurrentRuns:1,keyLifetimeYears:1},period:'2026-10',timezone:'UTC',startsAt:'2026-10-01T00:00:00Z',resetsAt:'2026-11-01T00:00:00Z',integrations:[{id:integrationId,slot:1,used:8,reserved:2}]};
export const profile={displayName:'Camille · Atelier de démonstration',email:'fixture@example.com',verified:true,admin:false};
export const methods=[{id:'1',provider:'password',usable:true}];
export const usage={offer:'PREMIUM',period:'2026-10',timezone:'UTC',startsAt:status.startsAt,resetsAt:status.resetsAt,used:12,reserved:2,limit:90,available:76,canLaunch:true};
export const issued={key:{...key,id:'2'.repeat(32),name:'Déploiement de démonstration'},credential:'argos_demo_NOT_VALID_FOR_SIMULATION'};
