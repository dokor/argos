import {expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {publicationConfiguration,publicationDefaults,type PublicationInput} from "./ci-publication-configuration";
import catalog from "./ci-integration-templates.json";
const valid:PublicationInput={...publicationDefaults,mode:"PREVIEW",repository:"customer/site",id:"42",botId:"101",consent:true};
it("starts disabled, without a destination or any consent, and never generates SYNC or reopening implicitly",()=>{
  const output=publicationConfiguration(publicationDefaults);expect(output.errors).toEqual([]);expect(output.value).toMatchObject({mode:"DISABLED",destination:null,allowPrivateDetails:false,allowPublicNotice:false,reopenResolved:false,groups:[]});
});
it("prepares a read-only destination-bound preview with explicit private/public consent and controlled caps",()=>{
  for(const provider of ["github","gitlab"] as const){const output=publicationConfiguration({...valid,provider});expect(output.errors).toEqual([]);expect(output.value).toMatchObject({mode:"PREVIEW",destination:{provider,id:"42",repository:"customer/site",botId:"101",visibility:"private"},allowPrivateDetails:true,maxNewIssues:5,maxNotifications:5});}
  const publicConfig=publicationConfiguration({...valid,visibility:"public",publicIssueId:"23"});expect(publicConfig.value).toMatchObject({labels:[],allowPrivateDetails:false,allowPublicNotice:true,publicIssueId:"23"});
});
it("refuses empty selections, missing consent, injected labels, foreign origins, invalid IDs and inflated budgets",()=>{
  for(const patch of [{id:"0"},{botId:"https://attacker.example"},{repository:"user/repo?token=synthetic"},{consent:false},{categories:[]},{environments:[]},{severities:[]},{labels:"argos-ci,::error::synthetic"},{labels:"one,one"},{maxNewIssues:11},{maxNewIssues:NaN},{maxNotifications:21},{publicIssueId:"1"}])expect(publicationConfiguration({...valid,...patch}).value).toBeNull();
});
it("ships exact complete models from the reviewed portable client, including the separate encrypted GitLab publisher",()=>{
  for(const [key,name] of [["github","github-actions.yml"],["gitlab","gitlab-ci.yml"],["gitlabPublication","gitlab-publication.yml"]] as const){expect(catalog.templates[key]).toBe(readFileSync(new URL("../../../../clients/ci/templates/"+name,import.meta.url),"utf8").replaceAll("\r\n","\n"));}
});
