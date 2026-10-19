import catalog from "./ci-integration-templates.json";
export type PublicationInput={provider:"github"|"gitlab";mode:"DISABLED"|"PREVIEW";repository:string;id:string;botId:string;visibility:"private"|"public";environments:string[];categories:string[];severities:string[];labels:string;maxNewIssues:number;maxNotifications:number;consent:boolean;publicIssueId:string};
export const publicationDefaults:PublicationInput={provider:"github",mode:"DISABLED",repository:"",id:"",botId:"",visibility:"private",environments:["production"],categories:["performance","security","seo","a11y"],severities:["critical","important"],labels:"argos-ci",maxNewIssues:5,maxNotifications:5,consent:false,publicIssueId:""};
export function publicationConfiguration(input:PublicationInput){
  const errors:string[]=[],id=(v:string)=>/^[1-9][0-9]{0,19}$/.test(v);
  const list=(v:string[],allowed:string[])=>v.length>0&&new Set(v).size===v.length&&v.every(x=>allowed.includes(x));
  const destinationValid=id(input.id)&&id(input.botId)&&input.repository.length<=256&&/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+){1,15}$/.test(input.repository);
  if(!["github","gitlab"].includes(input.provider)||!["DISABLED","PREVIEW"].includes(input.mode)||!["private","public"].includes(input.visibility))errors.push("configuration");
  if(input.mode!=="DISABLED"&&!destinationValid)errors.push("destination");
  if(!list(input.environments,["production","staging","preview"])||!list(input.categories,["performance","security","seo","a11y"])||!list(input.severities,["critical","important"]))errors.push("selection");
  const labels=input.visibility==="public"||input.labels===""?[]:input.labels.split(",").map(s=>s.trim());
  if(labels.length>10||new Set(labels).size!==labels.length||labels.some(s=>!/^[a-z0-9][a-z0-9._:-]{0,39}$/.test(s)))errors.push("labels");
  if(!Number.isInteger(input.maxNewIssues)||input.maxNewIssues<0||input.maxNewIssues>10||!Number.isInteger(input.maxNotifications)||input.maxNotifications<0||input.maxNotifications>20)errors.push("caps");
  if(input.mode==="PREVIEW"&&!input.consent)errors.push("consent");
  if(input.publicIssueId!==""&&(!id(input.publicIssueId)||input.visibility!=="public"||!destinationValid))errors.push("publicIssueId");
  if(errors.length)return {errors,value:null};
  return {errors,value:{...catalog.publication[input.provider],mode:input.mode,
    destination:destinationValid?{provider:input.provider,origin:input.provider==="github"?"https://api.github.com":"https://gitlab.com",id:input.id,repository:input.repository,botId:input.botId,visibility:input.visibility}:null,
    environments:input.environments,categories:input.categories,severities:input.severities,labels:input.visibility==="public"?[]:labels,
    maxNewIssues:input.maxNewIssues,maxNotifications:input.maxNotifications,
    allowPrivateDetails:input.visibility==="private"&&input.consent,allowPublicNotice:input.visibility==="public"&&input.consent,publicIssueId:input.publicIssueId||null}};
}
