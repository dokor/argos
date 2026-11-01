// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LangProvider } from "@/lib/i18n/LangContext";
import catalog from "@/lib/ci-error-catalog.json";
import templates from "@/lib/ci-integration-templates.json";
import DeveloperDocs, { DocCode } from "./DeveloperDocs";
import { topics, sections, docPath, type Topic } from "./content";
import { docsMetadata } from "./metadata";
import { localizedPath } from "@/lib/i18n/routes";
vi.mock("@/components/LocalizedLink",()=>({default:({href,children,...props}:React.ComponentProps<"a">)=><a href={href} {...props}>{children}</a>}));
vi.mock("@/components/ThemeToggle",()=>({default:()=>null}));
vi.mock("@/components/LangToggle",()=>({default:()=>null}));
vi.mock("@/components/site/SiteFooter",()=>({default:()=>null}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it.each(["fr","en"] as const)("renders public content and working stable anchors in %s without requesting any API",lang=>{
  const fetch=vi.fn();vi.stubGlobal("fetch",fetch);
  for(const topic of Object.keys(topics) as Topic[]){
    const {container,unmount}=render(<LangProvider initialLang={lang}><DeveloperDocs topic={topic}/></LangProvider>);
    expect(screen.getAllByRole("heading",{level:1})).toHaveLength(1);
    expect(screen.queryByLabelText("ARGOS_API_KEY")).not.toBeInTheDocument();
    for(const a of container.querySelectorAll('a[href^="#"]'))expect(container.querySelector(a.getAttribute("href")!)).not.toBeNull();
    expect(localizedPath("/docs"+(topic==="start"?"":"/"+topic),lang)).toBe(docPath(topic,lang));
    expect(docsMetadata(topic,lang).robots).toEqual({index:true,follow:true});
    expect(sections[topic].every(s=>s.paragraphs.every(p=>p[0]&&p[1]))).toBe(true);
    unmount();
  }
  expect(fetch).not.toHaveBeenCalled();
});
it.each(["fr","en"] as const)("publishes every canonical error anchor and localized safe action in %s",lang=>{
  const {container}=render(<LangProvider initialLang={lang}><DeveloperDocs topic="errors"/></LangProvider>);
  for(const [code,e]of Object.entries(catalog.errors)){
    const article=container.querySelector("#"+code.toLowerCase().replaceAll("_","-"))!;
    expect(article).not.toBeNull();expect(article.textContent).toContain(e[lang].action);expect(article.textContent).toContain(e.recovery);
  }
  fireEvent.change(screen.getByLabelText(lang==="fr"?"Chercher un code ou une action":"Find a code or action"),{target:{value:"AUTHENTICATION_FAILED"}});
  expect(container.querySelectorAll("article")).toHaveLength(1);
  fireEvent.change(screen.getByLabelText(lang==="fr"?"Étape":"Stage"),{target:{value:"PUBLICATION"}});
  expect(container.querySelectorAll("article")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button",{name:lang==="fr"?"Effacer les filtres":"Clear filters"}));
  expect(container.querySelectorAll("article")).toHaveLength(Object.keys(catalog.errors).length);
});
it("finds guide content and error codes locally, including accents and empty results",()=>{
  render(<DeveloperDocs/>);const input=screen.getByLabelText("Rechercher dans les guides"),nav=screen.getByRole("navigation",{name:"Rubriques"});
  fireEvent.change(input,{target:{value:"AUTHENTICATION_FAILED"}});expect(within(nav).getAllByRole("link")).toHaveLength(2);
  fireEvent.change(input,{target:{value:"zznoresults"}});expect(within(nav).queryAllByRole("link")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button",{name:"Effacer"}));expect(input).toHaveFocus();expect(within(nav).getAllByRole("link")).toHaveLength(10);
  fireEvent.change(input,{target:{value:"verification"}});expect(within(nav).getByRole("link",{name:"Domaines autorisés"})).toBeInTheDocument();
});
it.each(["github","gitlab"] as const)("copies the complete canonical %s templates, switching to a genuinely read-only preview",provider=>{
  const {container}=render(<DeveloperDocs topic={provider}/>);
  const select=screen.getByLabelText("Modèle à copier");
  expect(container.querySelector("pre")!.textContent).toBe(provider==="github"?templates.templates.github:templates.templates.gitlab);
  fireEvent.change(select,{target:{value:"preview"}});
  expect(container.querySelector("pre")!.textContent).toBe(provider==="github"?templates.templates.githubPreview:templates.templates.gitlabPreview);
  fireEvent.change(select,{target:{value:"publication"}});
  expect(container.querySelector("pre")!.textContent).toBe(provider==="github"?templates.templates.github:templates.templates.gitlabPublication);
});
it("copies only the displayed example and reports clipboard failure without execution or telemetry",async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined);vi.stubGlobal("navigator",{clipboard:{writeText}});
  const {rerender}=render(<DocCode value="node argos-ci.mjs doctor" label="doctor"/>);
  fireEvent.click(screen.getByRole("button",{name:"Copier doctor"}));
  expect(await screen.findByText("Exemple copié.")).toBeInTheDocument();
  expect(writeText).toHaveBeenCalledWith("node argos-ci.mjs doctor");
  writeText.mockRejectedValueOnce(Error("private clipboard detail"));
  rerender(<DocCode value="node argos-ci.mjs resume" label="resume"/>);
  expect(screen.queryByText("Exemple copié.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Copier resume"}));
  expect(await screen.findByText("Copie indisponible : sélectionnez le texte de l’exemple.")).toBeInTheDocument();
  expect(screen.queryByText("private clipboard detail")).not.toBeInTheDocument();
});
