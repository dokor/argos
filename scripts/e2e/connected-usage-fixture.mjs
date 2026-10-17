// Synthetic transport responses only. No production imports or account data.
export const usage={offer:'FREE',period:'2026-10',timezone:'UTC',startsAt:'2026-10-01T00:00:00Z',resetsAt:'2026-11-01T00:00:00Z',used:8,reserved:3,available:9,limit:20,canLaunch:true};
export const items=Array.from({length:24},(_,index)=>{
 const date=`2026-10-14T08:${String(59-index).padStart(2,'0')}:00Z`,state=index<8?'COUNTED':index<11?'RESERVED':'RELEASED';
 return {runId:index===0?'9007199254740992':String(2000+index),batchId:index%6===0?'700':null,state,period:index===10?'2026-09':'2026-10',createdAt:date,countedAt:state==='COUNTED'?date:null,releasedAt:state==='RELEASED'?date:null,url:'https://atelier.example/collection/'+(index===0?'une-url-technique-avec-un-chemin-long-et-des-parametres?tri=date&categorie=toutes':index)};
});
export function response(path,params=new URLSearchParams()) {
 if(path==='/api/account/me')return {displayName:'Camille · Démonstration',email:'fixture@example.com',verified:true};
 if(path==='/api/account/usage')return usage;
 if(path==='/api/account/usage/timeline'){
  const from=params.get('from'),until=params.get('until'),granularity=params.get('granularity');
  const boundaries=[from];
  while(boundaries.at(-1)<until){
   const date=new Date(boundaries.at(-1));
   if(granularity==='DAY')date.setUTCDate(date.getUTCDate()+1);
   if(granularity==='MONTH')date.setUTCMonth(date.getUTCMonth()+1);
   if(granularity==='YEAR')date.setUTCFullYear(date.getUTCFullYear()+1);
   boundaries.push(date.toISOString().slice(0,10));
  }
  const buckets=boundaries.slice(0,-1).map((start,index)=>{
   const total=items.filter(item=>item.state==='COUNTED'&&item.countedAt.slice(0,10)>=start&&item.countedAt.slice(0,10)<boundaries[index+1]).length;
   return {from:start,until:boundaries[index+1],total,values:total?{total}:{}};
  });
  const total=buckets.reduce((sum,bucket)=>sum+bucket.total,0);
  return {timezone:'UTC',snapshotAt:'2026-10-17T09:00:00Z',coverageFrom:'2026-10-01T00:00:00Z',undatedCredits:0,granularity,dimension:'GLOBAL',total,series:total?[{key:'total',label:'total',total}]:[],buckets,options:[],moreOptions:false};
 }
 if(path==='/api/account/usage/events'){
  const period=params.get('period')??usage.period,offset=Number(params.get('offset')??0),limit=Number(params.get('limit')??20);
  const rows=period==='2026-10'?items:period==='2026-09'?items.filter(row=>row.period==='2026-09'):[];
  return {items:rows.slice(offset,offset+limit),total:rows.length,limit,offset,period,snapshotAt:'2026-10-14T09:00:00Z'};
 }
 return null;
}
