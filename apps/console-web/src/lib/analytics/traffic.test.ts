import {afterEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {POST} from '@/app/api/traffic/route';
import {POST as consent} from '@/app/api/traffic/consent/route';
import {acquisition,trafficPayload} from './traffic';
const event={route:'/',lang:'fr',source:'direct'};
const req=(body:unknown,cookie='',origin='https://argos.test',agent='Browser')=>new NextRequest('https://argos.test/api/traffic',{method:'POST',headers:{origin,cookie,'content-type':'application/json','user-agent':agent},body:JSON.stringify(body)});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('rejects private paths and arbitrary acquisition data',()=>{
 for(const route of ['/report/secret','/?email=secret','/account','/en/faq','https://secret.test'])expect(trafficPayload({...event,route})).toBeUndefined();
 expect(trafficPayload({...event,utm_source:'secret'})).toBeUndefined();expect(trafficPayload({...event,source:'private-domain.test'})).toBeUndefined();
 expect(acquisition('?utm_campaign=private','https://private.test/secret','https://argos.test')).toBe('campaign');expect(acquisition('','https://www.google.com/search?q=secret','https://argos.test')).toBe('search');
});
it('never forwards without both configuration and consent, or for bots/cross-origin requests',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 await POST(req(event,'argos_traffic_consent_v1=granted'));
 vi.stubEnv('TRAFFIC_ANALYTICS_ENABLED','true');vi.stubEnv('ADMIN_API_TOKEN','synthetic');
 for(const cookie of ['', 'argos_traffic_consent_v1=refused','argos_product_consent_v2=granted'])await POST(req(event,cookie));
 await POST(req(event,'argos_traffic_consent_v1=granted','https://other.test'));await POST(req(event,'argos_traffic_consent_v1=granted','https://argos.test','Googlebot'));
 expect(fetch).not.toHaveBeenCalled();
});
it('uses closed dimensions, counts the first visit only, and clears the marker on withdrawal',async()=>{
 vi.stubEnv('TRAFFIC_ANALYTICS_ENABLED','true');vi.stubEnv('ADMIN_API_TOKEN','synthetic');const fetch=vi.fn().mockResolvedValue(new Response(null,{status:204}));vi.stubGlobal('fetch',fetch);
 const response=await POST(req(event,'argos_traffic_consent_v1=granted'));expect(response.headers.get('set-cookie')).toContain('argos_traffic_visit=1');expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({...event,visit:true});
 await POST(req(event,'argos_traffic_consent_v1=granted; argos_traffic_visit=1'));expect(JSON.parse(fetch.mock.calls[1][1].body).visit).toBe(false);
 expect((await POST(req({...event,route:'/report/private'},'argos_traffic_consent_v1=granted'))).status).toBe(400);
 const withdrawn=await consent(req({choice:'refused'}));expect(withdrawn.headers.get('set-cookie')).toContain('Max-Age=0');
});
