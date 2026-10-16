import {afterEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {accountProxy} from './account-proxy';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('forwards authenticated read actions with CSRF and no caller-selected owner',async()=>{
 vi.stubEnv('ACCOUNT_ORIGIN','http://localhost:3000');const fetch=vi.fn().mockResolvedValue(Response.json({items:[],unread:0,cursor:'1'}));vi.stubGlobal('fetch',fetch);const csrf='c'.repeat(43);
 const request=(body:unknown,token=true)=>new NextRequest('http://localhost:3000/api/account/notifications/1/read',{method:'POST',headers:{origin:'http://localhost:3000',cookie:`argos_account=synthetic; argos_account_csrf=${csrf}`,...token?{'x-argos-csrf':csrf}:{}},body:JSON.stringify(body)});
 expect((await accountProxy(request({},false),['notifications','1','read'])).status).toBe(403);expect(fetch).not.toHaveBeenCalled();
 expect((await accountProxy(request({ownerUserId:'20'}),['notifications','1','read'])).status).toBe(400);expect(fetch).not.toHaveBeenCalled();
 expect((await accountProxy(request({}),['notifications','1','read'])).status).toBe(200);const headers=fetch.mock.calls[0][1].headers as Headers;expect(headers.get('authorization')).toBe('Bearer synthetic');expect(headers.get('x-argos-csrf')).toBe(csrf);
});
it('allows bounded traffic periods/grouping and rejects arbitrary filters',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json({views:0}));vi.stubGlobal('fetch',fetch);
 const request=(query:string)=>new NextRequest('http://localhost:3000/api/account/admin/traffic?'+query,{headers:{cookie:'argos_account=synthetic'}});
 expect((await accountProxy(request('days=7&group=month'),['admin','traffic'])).status).toBe(200);
 expect((await accountProxy(request('days=7&group=private'),['admin','traffic'])).status).toBe(400);expect(fetch).toHaveBeenCalledTimes(1);
});
