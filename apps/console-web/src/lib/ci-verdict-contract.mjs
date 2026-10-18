// Pure trust-boundary validation, shared with the future portable CI client.
const object=v=>v!==null && typeof v==='object' && !Array.isArray(v);
const exact=(v,keys)=>object(v) && Object.keys(v).length===keys.length && keys.every(key=>Object.hasOwn(v,key));
const same=(a,b)=>Array.isArray(b)?Array.isArray(a) && a.length===b.length && b.every((v,i)=>same(a[i],v))
  :object(b)?exact(a,Object.keys(b)) && Object.keys(b).every(key=>same(a[key],b[key])):a===b;
export const validPolicy=(value,policy)=>same(value,policy);
export function validVerdict(value,policy,catalogue,errors) {
  if(!exact(value,['apiVersion','kind','admissionId','policyId','policyFingerprint','sampleCount','outcome','exitCode','error','fingerprints','confirmedFindings'])
    || value.apiVersion!==1 || value.kind!=='verdict-v1' || typeof value.admissionId!=='string'
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.admissionId)
    || value.policyId!==policy.policyId || value.policyFingerprint!==policy.fingerprint || ![1,2].includes(value.sampleCount)
    || !Array.isArray(value.confirmedFindings) || value.confirmedFindings.length>128)return false;
  if(value.outcome==='CONTROL_FAILED') {
    const error=value.error;
    const allowed=['MEASUREMENT_INCOMPLETE','REPORTS_INCOMPARABLE','COLLECTION_TIMEOUT','ANTIBOT_DETECTED','VERDICT_POLICY_UNSUPPORTED',
      'CONFIRMATION_REQUIRED','FINDINGS_UNCONFIRMED','WAIT_TIMEOUT','RUN_FAILED','RESOURCE_NOT_AVAILABLE'];
    if(!exact(error,['code','stage','category','messageKey','actionCode','retryable','recovery','retryAfterSeconds']) || !allowed.includes(error.code))return false;
    return value.exitCode===2 && value.fingerprints===null && value.confirmedFindings.length===0 && error.retryAfterSeconds===null
      && ['stage','category','messageKey','actionCode','retryable','recovery'].every(key=>error[key]===errors[error.code]?.[key]);
  }
  if(!['GO','SITE_NO_GO'].includes(value.outcome) || value.error!==null || value.sampleCount!==2
    || !exact(value.fingerprints,['scoring','measurement','scope'])
    || !Object.values(value.fingerprints).every(v=>typeof v==='string' && /^[a-f0-9]{64}$/.test(v)))return false;
  const seen=new Set();
  for(const item of value.confirmedFindings) {
    if(!exact(item,['key','category','severity','ticketEligible']) || typeof item.key!=='string' || !Object.hasOwn(catalogue,item.key)
      || item.category!==catalogue[item.key] || !['critical','important'].includes(item.severity)
      || item.ticketEligible!==policy.eligibleTicketKeys.includes(item.key) || seen.has(item.key))return false;
    seen.add(item.key);
  }
  const blocked=value.confirmedFindings.some(item=>item.severity===policy.pipelineSeverity);
  return value.outcome===(blocked?'SITE_NO_GO':'GO') && value.exitCode===(blocked?1:0);
}
