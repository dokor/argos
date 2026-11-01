import { constants, openSync, closeSync, fstatSync, lstatSync, readSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { requireControl } from './self-audit-policy.mjs';

export const MAX_EVIDENCE_BYTES=65536;
/** Expected hash and provenance are job outputs/context, never fields from the downloaded file. */
export function readTrustedEvidence(path,{digest,sha,invocation,repository}={}) {
  let fd;
  try {
    requireControl(/^[a-f0-9]{64}$/.test(digest??'') && /^[a-f0-9]{40}$/.test(sha??'')
      && /^[1-9][0-9]{0,19}:[1-9][0-9]{0,5}$/.test(invocation??'') && repository==='dokor/argos', 'evidence-invalid');
    const before=lstatSync(path);
    requireControl(before.isFile() && !before.isSymbolicLink() && before.size>0 && before.size<=MAX_EVIDENCE_BYTES,'evidence-invalid');
    fd=openSync(path,constants.O_RDONLY | (constants.O_NOFOLLOW??0));
    const opened=fstatSync(fd);
    requireControl(opened.isFile() && opened.dev===before.dev && opened.ino===before.ino && opened.size===before.size,'evidence-invalid');
    const bytes=Buffer.alloc(MAX_EVIDENCE_BYTES+1);let size=0;
    while(size<bytes.length) {const count=readSync(fd,bytes,size,bytes.length-size,null);if(!count)break;size+=count;}
    requireControl(size===opened.size && size<=MAX_EVIDENCE_BYTES && fstatSync(fd).size===size,'evidence-invalid');
    const raw=bytes.subarray(0,size);
    requireControl(createHash('sha256').update(raw).digest('hex')===digest,'evidence-invalid');
    const evidence=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
    requireControl(evidence?.repository===repository && evidence.invocation===invocation && evidence.expectedSha===sha,'evidence-invalid');
    return evidence;
  }catch {requireControl(false,'evidence-invalid');}
  finally {if(fd!==undefined)closeSync(fd);}
}
