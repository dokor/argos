// Synthetic transport responses only. No production imports or account data.
export const usage={offer:'FREE',period:'2026-10',timezone:'UTC',startsAt:'2026-10-01T00:00:00Z',resetsAt:'2026-11-01T00:00:00Z',used:8,reserved:3,available:9,limit:20,canLaunch:true};
export const items=Array.from({length:24},(_,index)=>{
 const date=`2026-10-14T08:${String(59-index).padStart(2,'0')}:00Z`,state=index<8?'COUNTED':index<11?'RESERVED':'RELEASED';
 return {runId:index===0?'9007199254740992':String(2000+index),batchId:index%6===0?'700':null,state,period:index===10?'2026-09':'2026-10',createdAt:date,countedAt:state==='COUNTED'?date:null,releasedAt:state==='RELEASED'?date:null,url:'https://atelier.example/collection/'+(index===0?'une-url-technique-avec-un-chemin-long-et-des-parametres?tri=date&categorie=toutes':index)};
});
export function response(path,params=new URLSearchParams()) {
 if(path==='/api/account/me')return {displayName:'Camille · Démonstration',email:'fixture@example.com',verified:true};
 if(path==='/api/account/usage')return usage;
 if(path==='/api/account/usage/events'){
  const period=params.get('period')??usage.period,offset=Number(params.get('offset')??0),limit=Number(params.get('limit')??20);
  const rows=period==='2026-10'?items:period==='2026-09'?items.filter(row=>row.period==='2026-09'):[];
  return {items:rows.slice(offset,offset+limit),total:rows.length,limit,offset,period,snapshotAt:'2026-10-14T09:00:00Z'};
 }
 return null;
}
