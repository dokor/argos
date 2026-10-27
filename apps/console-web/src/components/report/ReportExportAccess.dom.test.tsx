// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import ReportExport from "./ReportExport";
import {LangProvider} from "@/lib/i18n/LangProvider";
import {demoReport} from "@/components/marketing/reportDemoFixture";
import {accountFetch} from "@/lib/account-client";
vi.mock("next/navigation",()=>({usePathname:()=>"/share/"+"a".repeat(43)}));
vi.mock("@/lib/account-client",()=>({accountFetch:vi.fn()}));
afterEach(()=>vi.restoreAllMocks());
it.each([undefined,"42"])("rechecks authenticated access and closes the PDF preview when revoked (run %s)",async runId=>{
 const close=vi.fn();
 const preview={document:{title:"",body:{textContent:""}},opener:null,close};
 vi.spyOn(window,"open").mockReturnValue(preview as unknown as Window);
 vi.mocked(accountFetch).mockReset().mockRejectedValue(new Error("Expired or revoked"));
 render(<LangProvider><ReportExport report={{...demoReport("fr"),access:null}} runId={runId} shared/></LangProvider>);
 fireEvent.click(screen.getByRole("button",{name:"Exporter en PDF"}));
 await waitFor(()=>expect(close).toHaveBeenCalledOnce());
 expect(accountFetch).toHaveBeenCalledWith(runId?"runs/42/report":"shared-reports/"+"a".repeat(43));
 expect(screen.getByRole("status").textContent).not.toBe("");
});
