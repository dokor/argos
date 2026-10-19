// @vitest-environment jsdom
import {beforeEach,afterEach,expect,it,vi} from "vitest";
import {render,screen,fireEvent,waitFor,within,act} from "@testing-library/react";
import CiIntegrations from "./CiIntegrations";
import {LangProvider} from "@/lib/i18n/LangContext";
import {ciManagement,CiManagementError,type CiIssued,type CiKeys,type CiStatus,type CiTarget} from "@/lib/ci-management-client";
import {accountFetch} from "@/lib/account-client";
import {key,keys,status,target,issued,profile,usage,methods} from "./fixtures/ci-integrations.mjs";
const session=vi.hoisted(()=>({profile:{verified:true,email:"fixture@example.com"},usage:{used:12,reserved:2,available:76}}));
vi.mock("@/components/account/AccountSession",()=>({useAccountSession:()=>session}));
vi.mock("@/lib/ci-management-client",async original=>({...await original<typeof import("@/lib/ci-management-client")>(),ciManagement:vi.fn()}));
vi.mock("@/lib/account-client",async original=>({...await original<typeof import("@/lib/account-client")>(),accountFetch:vi.fn()}));
let keyPage:CiKeys=structuredClone(keys) as CiKeys,snapshot:CiStatus=structuredClone(status),domainPage:{items:CiTarget[];nextCursor:string|null}={items:[structuredClone(target)] as CiTarget[],nextCursor:null};
const now=Date.parse("2026-10-19T10:00:00Z");
beforeEach(()=>{
  vi.spyOn(Date,"now").mockReturnValue(now);vi.spyOn(document,"visibilityState","get").mockReturnValue("visible");
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
  session.profile={...profile};session.usage={...usage};keyPage=structuredClone(keys);snapshot=structuredClone(status);domainPage={items:[structuredClone(target)] as CiTarget[],nextCursor:null};
  vi.mocked(accountFetch).mockImplementation(async path=>(path==="methods"?methods:{accepted:true}) as never);
  vi.mocked(ciManagement).mockImplementation(async(path,method="GET",body)=>{
    if(method==="GET")return (path==="status"?snapshot:path.startsWith("keys")?keyPage:domainPage) as never;
    if(path==="keys"){const value={...issued,key:{...issued.key,name:(body as {name:string}).name}};keyPage.items=[value.key,...keyPage.items] as typeof keyPage.items;return value as never;}
    if(path.endsWith("/rotate")){keyPage.items=[issued.key,{...key,overlapUntil:"2026-10-19T10:15:00Z"}] as typeof keyPage.items;return issued as never;}
    if(path.startsWith("keys/")&&method==="DELETE"){keyPage.items=[{...key,revokedAt:"2026-10-19T10:00:00Z"}] as typeof keyPage.items;return keyPage.items[0] as never;}
    return {} as never;
  });
});
afterEach(()=>{vi.restoreAllMocks();vi.clearAllMocks();});
async function ready(){render(<CiIntegrations/>);await screen.findByRole("heading",{name:"Vos clés API"});}
async function startCreate(){await ready();fireEvent.click(screen.getByRole("button",{name:"Créer une clé"}));fireEvent.change(screen.getByLabelText("Nom de la clé"),{target:{value:"Déploiement"}});fireEvent.click(screen.getByRole("checkbox",{name:target.origin}));fireEvent.click(screen.getByRole("button",{name:"Continuer"}));}
async function confirm(){fireEvent.change(screen.getByLabelText("Mot de passe actuel"),{target:{value:"synthetic-password"}});fireEvent.click(screen.getByRole("button",{name:"Confirmer et continuer"}));}
it("reads only authenticated management resources and never admits an audit or asks for a credential",async()=>{
  await ready();expect(vi.mocked(ciManagement).mock.calls.every(call=>call[1]==="GET")).toBe(true);expect(screen.queryByLabelText("ARGOS_API_KEY")).not.toBeInTheDocument();expect(screen.getByText(/deux analyses ensemble/)).toBeInTheDocument();
});
it("requires reauthentication before creating a restricted key, then hides its one-time secret on pagehide",async()=>{
  await startCreate();expect(vi.mocked(ciManagement).mock.calls.filter(call=>call[1]==="POST")).toHaveLength(0);await confirm();
  await screen.findByRole("heading",{name:"Copiez votre nouvelle clé maintenant"});expect(accountFetch).toHaveBeenCalledWith("auth/reauth","POST",{password:"synthetic-password"});
  expect(ciManagement).toHaveBeenCalledWith("keys","POST",{name:"Déploiement",scopes:["audits:write","results:read","usage:read"],targetIds:[target.id]});
  fireEvent(window,new Event("pagehide"));expect(screen.queryByRole("heading",{name:"Copiez votre nouvelle clé maintenant"})).not.toBeInTheDocument();expect(screen.queryByText(issued.credential)).not.toBeInTheDocument();
});
it("does not reveal a late creation response after the page was hidden and restored",async()=>{
  const original=vi.mocked(ciManagement).getMockImplementation()!;let release:((value:CiIssued)=>void)|undefined;
  vi.mocked(ciManagement).mockImplementation((...args)=>args[0]==="keys"&&args[1]==="POST"?new Promise(resolve=>{release=resolve as typeof release;}):original(...args));
  await startCreate();await confirm();await waitFor(()=>expect(release).toBeDefined());fireEvent(window,new Event("pagehide"));
  await act(async()=>{release!(issued as CiIssued);});await screen.findByText(/son secret a été masqué/);expect(screen.queryByText(issued.credential)).not.toBeInTheDocument();
});
it("never retries an ambiguous mutation and requires refreshing reads before creating again",async()=>{
  const original=vi.mocked(ciManagement).getMockImplementation()!;
  vi.mocked(ciManagement).mockImplementation((...args)=>args[0]==="keys"&&args[1]==="POST"?Promise.reject(new CiManagementError("TRANSPORT_FAILED")):original(...args));
  await startCreate();await confirm();await screen.findByRole("alert");expect(screen.getByRole("button",{name:"Créer une clé"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"Actualiser les lectures"}));await waitFor(()=>expect(screen.queryByRole("alert")).not.toBeInTheDocument());expect(vi.mocked(ciManagement).mock.calls.filter(call=>call[1]==="POST")).toHaveLength(1);
});
it("keeps revocation available with CI disabled while refusing new keys and rotation",async()=>{
  snapshot={...snapshot,enabled:false,eligible:false,limits:null as unknown as typeof snapshot.limits};await ready();
  expect(screen.getByRole("button",{name:"Créer une clé"})).toBeDisabled();expect(screen.getByRole("button",{name:"Renouveler"})).toBeDisabled();expect(screen.getByRole("button",{name:"Révoquer"})).toBeEnabled();
  fireEvent.click(screen.getByRole("button",{name:"Révoquer"}));await confirm();await screen.findByText("Révoquée");expect(ciManagement).toHaveBeenCalledWith("keys/"+key.id,"DELETE",{});
});
it("rotates with the same slot and usage, without treating the overlap as another quota",async()=>{
  await ready();fireEvent.click(screen.getByRole("button",{name:"Renouveler"}));await confirm();await screen.findByRole("heading",{name:"Copiez votre nouvelle clé maintenant"});fireEvent.click(screen.getByRole("button",{name:"J’ai enregistré la clé"}));
  await screen.findByText("Transition de rotation");expect(screen.getAllByText("Emplacement 1")).toHaveLength(2);expect(snapshot.integrations).toHaveLength(1);expect(ciManagement).toHaveBeenCalledWith("keys/"+key.id+"/rotate","POST",{});
});
it("handles exhausted slots explicitly and does not imply rotation refills the monthly quota",async()=>{
  keyPage.integrations=[1,2,3].map(n=>({id:integrationId(n),slot:n,canReplace:false}));snapshot.integrations[0].used=30;snapshot.integrations[0].reserved=0;
  await ready();expect(screen.getByRole("button",{name:"Créer une clé"})).toBeDisabled();expect(screen.getByText(/Tous les emplacements sont occupés/)).toBeInTheDocument();expect(screen.getByRole("button",{name:"Renouveler"})).toBeEnabled();
});
function integrationId(n:number){return `29e4eac${n}-00a9-4de4-81dc-f4686fb677cc`;}
it("keeps config available for unverified accounts while making no private management requests",async()=>{
  session.profile={...session.profile,verified:false};render(<CiIntegrations/>);await screen.findByText(/Vérifier l’adresse email/);expect(ciManagement).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Configuration CI"}));expect(screen.getByRole("heading",{name:"Configuration CI"})).toBeInTheDocument();
});
it("prepares disabled publication config and an explicit preview, without any Git or machine request",async()=>{
  await ready();const before=vi.mocked(ciManagement).mock.calls.length;fireEvent.click(screen.getByRole("button",{name:"Configuration CI"}));fireEvent.click(screen.getByRole("checkbox",{name:"Préparer la configuration optionnelle d’issues"}));
  expect(screen.getByRole("region",{name:"ARGOS_PUBLICATION_CONFIG (JSON)"})).toHaveTextContent('"mode": "DISABLED"');
  fireEvent.change(screen.getByLabelText("Mode de la configuration préparée"),{target:{value:"PREVIEW"}});expect(screen.queryByRole("region",{name:"ARGOS_PUBLICATION_CONFIG (JSON)"})).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Chemin du dépôt/projet"),{target:{value:"customer/site"}});fireEvent.change(screen.getByLabelText("ID numérique immuable du dépôt/projet"),{target:{value:"42"}});expect(screen.getByLabelText("ID numérique du bot vérifié")).toHaveValue("41898282");fireEvent.click(screen.getByRole("checkbox",{name:/J’autorise les constats/}));
  expect(screen.getByRole("region",{name:"ARGOS_PUBLICATION_CONFIG (JSON)"})).toHaveTextContent('"mode": "PREVIEW"');expect(vi.mocked(ciManagement).mock.calls).toHaveLength(before);
});
it("renders English controls and controlled errors without raw provider text",async()=>{
  vi.mocked(ciManagement).mockRejectedValue(new CiManagementError("FEATURE_NOT_AVAILABLE"));render(<LangProvider initialLang="en"><CiIntegrations/></LangProvider>);
  const alert=await screen.findByRole("alert");expect(within(alert).getByText("Premium CI access is unavailable.")).toBeInTheDocument();expect(screen.getByRole("button",{name:"Create key"})).toBeDisabled();
});
