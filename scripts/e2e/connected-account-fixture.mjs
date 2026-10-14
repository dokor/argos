// Synthetic account data for browser recipes only; never imported by production code.
export const profile = {displayName:'Camille · Démonstration',email:'fixture@example.com',verified:true};
export const methods = [{id:'1',provider:'password'},{id:'2',provider:'github'}];
export const sessions = [{id:'10',createdAt:'2026-10-14T08:30:00Z',current:true},{id:'11',createdAt:'2026-10-12T14:00:00Z',current:false}];
export function response(path) {
  if(path==='/api/account/me') return profile;
  if(path==='/api/account/methods') return methods;
  if(path==='/api/account/sessions') return sessions;
  if(path==='/api/account/auth/providers') return {providers:['github','google'],enabled:true};
  if(path==='/api/account/return') return {returnTo:'/account/settings'};
  if(path==='/api/account/usage') return {offer:'FREE',period:'2026-10',timezone:'UTC',startsAt:'2026-10-01T00:00:00Z',resetsAt:'2027-01-01T00:00:00Z',used:2,reserved:1,limit:20,canLaunch:true};
  return null;
}
