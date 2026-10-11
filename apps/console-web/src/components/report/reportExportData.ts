import type {Report} from './types';
export async function loadExportReport(token:string, request:typeof fetch=fetch):Promise<Report> {
 if(!/^[A-Za-z0-9_-]+$/.test(token))throw new Error('Export unavailable');
 const response=await request('/api/reports/'+encodeURIComponent(token),{cache:'no-store',credentials:'same-origin',redirect:'error'});
 if(!response.ok)throw new Error('Export unavailable');const data=await response.json();
 if(!data?.scores||!data?.summary||!Array.isArray(data?.issues)||typeof data.domain!=='string')throw new Error('Export unavailable');return data;
}
export function exportTitle(format:'summary'|'full',date:string):string {
 const parsed=new Date(date);return 'Argos-'+format+'-'+(Number.isFinite(parsed.getTime())?parsed.toISOString().slice(0,10):'report');
}
