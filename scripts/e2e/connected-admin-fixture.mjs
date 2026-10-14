import {response as accountResponse} from './connected-analysis-fixture.mjs';
export const target='9007199254740993';
export function fixture(){
 let users=[{id:'1',displayName:'Camille Martin',email:'camille@example.com',role:'ADMIN',state:'ACTIVE',offer:'FREE',version:0,monthlyLimit:null},{id:target,displayName:'Morgan Petit',email:'morgan@example.com',role:'USER',state:'ACTIVE',offer:'FREE',version:3,monthlyLimit:200},{id:'3',displayName:'Alex Durand',email:'alex@example.com',role:'USER',state:'SUSPENDED',offer:'FREE',version:1,monthlyLimit:25}].map((u,i)=>({...u,canEditEntitlement:u.role!=='ADMIN',canSuspend:u.role!=='ADMIN',createdAt:'2026-10-13T08:00:00Z',usage:{offer:'FREE',period:'2026-10',timezone:'Europe/Paris',startsAt:'2026-09-30T22:00:00Z',resetsAt:'2026-10-31T23:00:00Z',used:i===1?182:32,reserved:i===1?5:0,limit:u.monthlyLimit??100,available:i===1?13:68,canLaunch:true}}));
 const events=[];let mode='';
 return {setMode(v){mode=v;},respond(path,query,method='GET',body){
  const ok=data=>({status:200,data});
  if(path==='/api/account/csrf')return ok({csrf:'c'.repeat(43)});
  if(path==='/api/account/me')return ok({displayName:'Camille Martin',email:'camille@example.com',verified:true,admin:mode!=='denied'});
  if(path==='/api/account/methods')return ok([{id:'4',provider:'password'}]);
  if(path==='/api/account/admin/entitlement-options')return ok({offers:['FREE','PRO'],offerLimits:[{offer:'FREE',monthlyLimit:100},{offer:'PRO',monthlyLimit:null}],reasonCodes:['SUPPORT_REQUEST','PLAN_ADJUSTMENT','ABUSE_REVIEW','ACCOUNT_RECOVERY'],maximumMonthlyLimit:Number.MAX_SAFE_INTEGER});
  if(path==='/api/account/admin/queue')return ok({queued:3,running:2});
  if(path.endsWith('/entitlement')||path.endsWith('/suspension')){
   const id=path.split('/').at(-2),u=users.find(v=>v.id===id);if(mode==='conflict'||body.expectedVersion!==u.version)return {status:409,data:{error:'version_conflict'}};
   const before=structuredClone(u);if(path.endsWith('/entitlement')){u.offer=body.offer;u.monthlyLimit=body.monthlyLimit;u.usage.limit=body.monthlyLimit??(body.offer==='PRO'?null:100);u.usage.available=u.usage.limit===null?null:u.usage.limit-u.usage.used-u.usage.reserved;}else u.state=body.suspended?'SUSPENDED':'ACTIVE';u.version++;
   events.unshift({id:String(events.length+1),actorId:'1',targetId:id,createdAt:'2026-10-14T12:00:00Z',oldOffer:before.offer,newOffer:u.offer,oldLimit:before.monthlyLimit,newLimit:u.monthlyLimit,oldState:before.state,newState:u.state,reasonCode:body.reasonCode,requestId:'synthetic-request'});return ok({changed:true,version:u.version});
  }
  if(path.includes('/events'))return ok({items:events,nextCursor:null});
  if(path.startsWith('/api/account/admin/users')){
   if(mode==='error'||mode==='stale')return {status:503,data:{error:'account_unavailable'}};
   const id=path.split('/').at(-1);
   if(id==='users'){
    let items=mode==='empty'?[]:users.filter(u=>(!query.get('q')||(u.displayName+' '+u.email).toLowerCase().includes(query.get('q').toLowerCase()))&&(!query.get('state')||u.state===query.get('state'))&&(!query.get('offer')||u.offer===query.get('offer')));
    return ok({items,nextCursor:null});
   }
   const u=structuredClone(users.find(v=>v.id===id));if(!u)return {status:404,data:{error:'resource_unavailable'}};
   if(mode==='zero'){u.monthlyLimit=0;u.usage={...u.usage,used:0,reserved:0,limit:0,available:0,canLaunch:false};}
   if(mode==='unlimited'){u.offer='PRO';u.monthlyLimit=null;u.usage={...u.usage,limit:null,available:null};}
   if(mode==='archived'){u.state='ARCHIVED';u.canEditEntitlement=false;u.canSuspend=false;}
   return ok(u);
  }
  const data=accountResponse(path,query);return {status:data?200:404,data:data??{error:'resource_unavailable'}};
 }};
}
