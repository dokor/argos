import {expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {publicationConfiguration,publicationDefaults,type PublicationInput} from "./ci-publication-configuration";
import catalog from "./ci-integration-templates.json";
const valid:PublicationInput={...publicationDefaults,mode:"PREVIEW",repository:"customer/site",id:"42",botId:"41898282",consent:true};
it("starts disabled, without a destination or any consent, and never generates SYNC or reopening implicitly",()=>{
  const output=publicationConfiguration(publicationDefaults);expect(output.errors).toEqual([]);expect(output.value).toMatchObject({mode:"DISABLED",destination:null,allowPrivateDetails:false,allowPublicNotice:false,reopenResolved:false,groups:[]});
});
it("prepares a read-only destination-bound preview with explicit private/public consent and controlled caps",()=>{
  for(const provider of ["github","gitlab"] as const){const botId=provider==="github"?"41898282":"101",output=publicationConfiguration({...valid,provider,botId});expect(output.errors).toEqual([]);expect(output.value).toMatchObject({mode:"PREVIEW",destination:{provider,id:"42",repository:"customer/site",botId,visibility:"private"},allowPrivateDetails:true,maxNewIssues:5,maxNotifications:5});}
  const publicConfig=publicationConfiguration({...valid,visibility:"public",publicIssueId:"23"});expect(publicConfig.value).toMatchObject({labels:[],allowPrivateDetails:false,allowPublicNotice:true,publicIssueId:"23"});
});
it("derives fail-closed read-only previews without changing pins, proof handling or the reviewed client",()=>{
  expect(catalog.templates.githubPreview).not.toContain("issues: write");expect(catalog.templates.githubPreview).not.toContain("ARGOS_GITHUB_JOURNAL_SAS_URL:");
  expect(catalog.templates.githubPreview).toBe(catalog.templates.github.replace("      issues: write\n","      issues: read\n").replace("          ARGOS_GITHUB_JOURNAL_SAS_URL: ${{ secrets.ARGOS_GITHUB_JOURNAL_SAS_URL }}\n","          ARGOS_GITHUB_JOURNAL_READ_SAS_URL: ${{ secrets.ARGOS_GITHUB_JOURNAL_READ_SAS_URL }}\n"));
  expect(catalog.templates.gitlabPreview).toContain("name: argos-publisher-preview");expect(catalog.templates.gitlabPreview).toContain("env -u ARGOS_API_KEY -u ARGOS_GITLAB_PUBLISH_TOKEN -u ARGOS_GITLAB_JOURNAL_SAS_URL node argos-ci.mjs publish-gitlab");
});
it("refuses empty selections, missing consent, injected labels, foreign origins, invalid IDs and inflated budgets",()=>{
  for(const patch of [{id:"0"},{botId:"https://attacker.example"},{repository:"user/repo?token=synthetic"},{consent:false},{categories:[]},{environments:[]},{severities:[]},{labels:"argos-ci,::error::synthetic"},{labels:"one,one"},{maxNewIssues:11},{maxNewIssues:NaN},{maxNotifications:21},{publicIssueId:"1"}])expect(publicationConfiguration({...valid,...patch}).value).toBeNull();
});
it("ships exact complete models from the reviewed portable client, including the separate encrypted GitLab publisher",()=>{
  for(const [key,name] of [["github","github-actions.yml"],["gitlab","gitlab-ci.yml"],["gitlabPublication","gitlab-publication.yml"]] as const){expect(catalog.templates[key]).toBe(readFileSync(new URL("../../../../clients/ci/templates/"+name,import.meta.url),"utf8").replaceAll("\r\n","\n"));}
});
