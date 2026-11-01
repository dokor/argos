import { ControlError, requireControl } from './self-audit-policy.mjs';

/** Origin comes from trusted configuration/code, never a report, Location or artifact. */
export function trustedEndpoint(origin, path) {
  try {
    const base=new URL(origin);
    requireControl(base.protocol==='https:' && base.origin===origin && !base.username && !base.password, 'configuration-invalid');
    requireControl(typeof path==='string' && path.startsWith('/') && !path.startsWith('//')
      && !/[\\\s\u0000-\u001f\u007f#]/u.test(path) && !/%(?:2e|2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(path)
      && !/(?:^|\/)\.{1,2}(?:\/|$|\?)/.test(path), 'configuration-invalid');
    const url=new URL(path,base);
    requireControl(url.origin===origin && !url.username && !url.password, 'configuration-invalid');
    return url.href;
  }catch {throw new ControlError('configuration-invalid');}
}

/** A deadline covers headers AND streamed bytes. Never expose an upstream error body. */
export async function boundedJson(response, maxBytes, signal) {
  const reader=response.body?.getReader();
  const chunks=[];let size=0;
  const abort=()=>{void reader?.cancel().catch(()=>{});};
  try {
    requireControl(Number.isSafeInteger(maxBytes) && maxBytes>0 && !!reader
      && /^application\/(?:json|[a-z0-9.-]+\+json)(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get('content-type')??''), 'response-invalid');
    const length=response.headers.get('content-length');
    requireControl(length===null || /^\d+$/.test(length) && Number(length)<=maxBytes, 'response-invalid');
    signal?.addEventListener('abort',abort,{once:true});
    while(true) {
      signal?.throwIfAborted();const {done,value}=await reader.read();signal?.throwIfAborted();
      if(done)break;
      size+=value.byteLength;requireControl(size<=maxBytes,'response-invalid');chunks.push(Buffer.from(value));
    }
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
  }catch {throw new ControlError('response-invalid');}
  finally {signal?.removeEventListener('abort',abort);await reader?.cancel().catch(()=>{});reader?.releaseLock();}
}
