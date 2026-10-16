// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import ProductAnalytics from './ProductAnalytics';
const route=vi.hoisted(()=>({path:'/'}));
vi.mock('next/navigation',()=>({usePathname:()=>route.path}));
vi.mock('@/components/LocalizedLink',()=>({default:({href,children}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a href={href}>{children}</a>}));
beforeEach(()=>{route.path='/';});afterEach(()=>vi.unstubAllGlobals());
function collector(fail=false){const choices:Record<string,string>={};const fetch=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{if(!init?.method)return Response.json({enabled:true,choice:choices[String(url)]??'unset'});if(!fail&&String(url).endsWith('/consent'))choices[String(url)]=JSON.parse(String(init.body)).choice;return new Response(null,{status:fail?503:204});});vi.stubGlobal('fetch',fetch);return fetch;}
it('requires granular consent, counts rendered SPA navigations once and stops on withdrawal',async()=>{
 const fetch=collector();const view=render(<ProductAnalytics/>);
 await screen.findByRole('button',{name:'Personnaliser'});
 expect(fetch.mock.calls.filter(([u])=>u==='/api/traffic')).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:'Personnaliser'}));
 const traffic=screen.getByRole('checkbox',{name:'Mesure de fréquentation'});expect(traffic).not.toBeChecked();expect(screen.getByRole('checkbox',{name:'Mesure produit'})).not.toBeChecked();
 fireEvent.click(traffic);fireEvent.click(screen.getByRole('button',{name:'Enregistrer mes choix'}));
 await screen.findByRole('button',{name:'Gérer mes cookies'});await waitFor(()=>expect(fetch.mock.calls.filter(([u])=>u==='/api/traffic')).toHaveLength(1));
 expect(fetch.mock.calls.filter(([u])=>u==='/api/product-analytics')).toHaveLength(0);
 view.rerender(<ProductAnalytics/>);expect(fetch.mock.calls.filter(([u])=>u==='/api/traffic')).toHaveLength(1);
 route.path='/faq';view.rerender(<ProductAnalytics/>);await waitFor(()=>expect(fetch.mock.calls.filter(([u])=>u==='/api/traffic')).toHaveLength(2));
 route.path='/report/private-token';view.rerender(<ProductAnalytics/>);expect(fetch.mock.calls.filter(([u])=>u==='/api/traffic')).toHaveLength(2);
 route.path='/faq';view.rerender(<ProductAnalytics/>);await waitFor(()=>expect(fetch.mock.calls.filter(([u])=>u==='/api/traffic')).toHaveLength(3));
 fireEvent.click(screen.getByRole('button',{name:'Gérer mes cookies'}));fireEvent.click(screen.getByRole('button',{name:'Tout refuser / retirer'}));await screen.findByRole('button',{name:'Gérer mes cookies'});
 route.path='/';view.rerender(<ProductAnalytics/>);expect(fetch.mock.calls.filter(([u])=>u==='/api/traffic')).toHaveLength(3);
 expect(JSON.stringify(fetch.mock.calls)).not.toContain('private-token');
});
it('keeps the preference error visible and never collects after a failed choice',async()=>{
 const fetch=collector(true);render(<ProductAnalytics/>);fireEvent.click(await screen.findByRole('button',{name:'Tout accepter'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Choix non enregistré');expect(screen.getByRole('button',{name:'Tout refuser / retirer'})).toBeInTheDocument();expect(fetch.mock.calls.filter(([u])=>u==='/api/traffic')).toHaveLength(0);
});
