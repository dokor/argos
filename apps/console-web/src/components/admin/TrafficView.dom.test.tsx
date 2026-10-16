// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from 'vitest';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import TrafficView from './TrafficView';
import {accountFetch} from '@/lib/account-client';
const session=vi.hoisted(()=>({ready:true,denied:false,profile:{verified:true,admin:true}}));
vi.mock('@/components/account/AccountSession',()=>({useAccountSession:()=>session}));
vi.mock('@/lib/account-client',()=>({accountFetch:vi.fn()}));
vi.mock('@/components/LocalizedLink',()=>({default:({href,children}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a href={href}>{children}</a>}));
const metrics={enabled:true,from:'2026-10-01',until:'2026-10-16',views:80,visits:20,evolution:[{date:'2026-10-01',views:80,visits:20}],pages:[{value:'/faq',views:80}],sources:[{value:'search',views:80}],languages:[{value:'fr',views:80}]};
beforeEach(()=>{session.profile.admin=true;vi.mocked(accountFetch).mockReset().mockResolvedValue(metrics);});
it('keeps audience separate, changes periods/grouping and exposes read errors',async()=>{
 render(<TrafficView/>);await screen.findByText('80',{selector:'dd'});expect(screen.getByRole('link',{name:'Mesure produit'})).toHaveAttribute('href','/account/admin/analytics');
 fireEvent.change(screen.getByLabelText('Période'),{target:{value:'7'}});fireEvent.change(screen.getByLabelText('Regrouper par'),{target:{value:'month'}});
 await waitFor(()=>expect(accountFetch).toHaveBeenCalledWith('admin/traffic?days=7&group=month','GET',undefined,expect.any(AbortSignal)));
 vi.mocked(accountFetch).mockRejectedValue(new Error('offline'));fireEvent.click(screen.getByRole('button',{name:'Actualiser'}));expect(await screen.findByRole('alert')).toHaveTextContent('indisponibles');
});
it('does not request statistics for an ordinary account',()=>{session.profile.admin=false;render(<TrafficView/>);expect(screen.getByRole('alert')).toHaveTextContent('Accès administrateur');expect(accountFetch).not.toHaveBeenCalled();});
