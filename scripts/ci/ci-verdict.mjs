import { readFileSync } from 'node:fs';
import { validVerdict } from '../../apps/console-web/src/lib/ci-verdict-contract.mjs';
const resource=name=>JSON.parse(readFileSync(new URL('../../apps/api-backend/src/main/resources/ci/'+name,import.meta.url),'utf8'));
const policy=resource('verdict-policy-v1.json'),catalogue=resource('export-catalog-v1.json'),errors=resource('error-catalog-v1.json').errors;
/** Exit 3 exposes enabled publication failures, preserving the original audit verdict/exit. */
export function pipelineResult(verdict,{publication='DISABLED'}={}) {
  const valid=validVerdict(verdict,policy,catalogue,errors);
  const publisher=['DISABLED','PREVIEW','NO_FINDINGS','LIMIT_REACHED','SUCCEEDED','FAILED','UNKNOWN'].includes(publication)?publication:'UNKNOWN';
  const outcome=valid?verdict.outcome:'CONTROL_FAILED',auditExitCode=valid?verdict.exitCode:2;
  return Object.freeze({auditOutcome:outcome,auditExitCode,publication:publisher,
    exitCode:auditExitCode===2?2:['FAILED','UNKNOWN'].includes(publisher)?3:auditExitCode,
    errorCode:valid?verdict.error?.code??null:'TRANSPORT_FAILED'});
}
