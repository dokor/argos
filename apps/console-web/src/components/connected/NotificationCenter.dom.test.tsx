// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,fireEvent,render,screen} from "@/test/render";
import NotificationCenter,{type Inbox,type Notice} from './NotificationCenter';
import {accountFetch} from '@/lib/account-client';
vi.mock('@/lib/account-client',()=>({accountFetch:vi.fn()}));
vi.mock('@/components/LocalizedLink',()=>({default:({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a href={href} {...props}>{children}</a>}));
const notice=(id:string):Notice=>({id,type:'ANALYSIS_PARTIAL',hostname:'example.com',count:null,createdAt:'2026-10-16T12:00:00Z',readAt:null,href:'/account/runs/42'});
const inbox=(items:Notice[]):Inbox=>({items,unread:items.filter(n=>!n.readAt).length,cursor:items[0]?.id??'0',serverTime:'2026-10-16T12:00:00Z'});
beforeEach(()=>{vi.useFakeTimers();vi.mocked(accountFetch).mockReset();vi.spyOn(document,'hasFocus').mockReturnValue(true);});
afterEach(()=>vi.useRealTimers());
it('loads history silently, exposes unread state, preserves reading on open and restores focus on Escape',async()=>{
  vi.mocked(accountFetch).mockResolvedValue(inbox([notice('1')]));
  render(<NotificationCenter/>);await act(async()=>{});
  const bell=screen.getByRole('button',{name:'Notifications (1 non lues)'});
  expect(screen.queryByText('Analyse terminée — résultats partiels')).not.toBeInTheDocument();
  fireEvent.click(bell);
  expect(screen.getByRole('link',{name:/Analyse terminée/})).toHaveAttribute('href','/account/runs/42');
  expect(accountFetch).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(screen.getByRole('region',{name:'Notifications'}),{key:'Escape'});
  expect(bell).toHaveFocus();expect(bell).toHaveAttribute('aria-expanded','false');
});
it('toasts only a new event once, deduplicates polling and marks an item read',async()=>{
  let value=inbox([]);vi.mocked(accountFetch).mockImplementation(async(path)=>path==='notifications'?value:inbox([{...notice('1'),readAt:'2026-10-16T12:01:00Z'}]));
  render(<NotificationCenter/>);await act(async()=>{});value=inbox([notice('1')]);
  await act(()=>vi.advanceTimersByTimeAsync(15000));
  expect(screen.getByText('Analyse terminée — résultats partiels')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Fermer la notification'}));
  await act(()=>vi.advanceTimersByTimeAsync(15000));
  expect(screen.queryByText('Analyse terminée — résultats partiels')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Notifications (1 non lues)'}));
  fireEvent.click(screen.getByRole('button',{name:'Marquer comme lu'}));await act(async()=>{});
  expect(accountFetch).toHaveBeenCalledWith('notifications/1/read','POST',{});
  expect(screen.getByRole('button',{name:'Notifications'})).toBeInTheDocument();
});
it('does not toast bursts and retains retry and empty states',async()=>{
  vi.mocked(accountFetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(inbox([])).mockResolvedValue(inbox([notice('2'),notice('1')]));
  render(<NotificationCenter/>);await act(async()=>{});fireEvent.click(screen.getByRole('button',{name:'Notifications'}));
  expect(screen.getByRole('alert')).toHaveTextContent('indisponibles');
  fireEvent.click(screen.getByRole('button',{name:'Réessayer'}));await act(async()=>{});
  expect(screen.getByText('Aucune notification pour le moment.')).toBeInTheDocument();
  await act(()=>vi.advanceTimersByTimeAsync(15000));
  expect(screen.queryByRole('button',{name:'Fermer la notification'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Tout marquer comme lu'}));await act(async()=>{});
  expect(accountFetch).toHaveBeenCalledWith('notifications/through/2/read','POST',{});
});
