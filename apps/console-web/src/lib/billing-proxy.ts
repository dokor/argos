import {randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {boundedJson} from "./bounded-request";
import {ciBackendOrigin} from "./ci-backend-origin";
import {billingCodes,billingSnapshot,stripeDestination,record,exact,type BillingCode} from "./billing-contract";
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow"};
const error=(code:BillingCode,status=503,requestId:string=randomUUID())=>NextResponse.json({error:code,requestId},{status,headers});
/** Browser never chooses customer, price, subscription, origin or return URL. */
export async function billingProxy(request:NextRequest,parts:string[],auth:()=>Headers|NextResponse):Promise<NextResponse>{
  const path=parts.join("/"),method=request.method;
  if(request.nextUrl.search||!(method==="GET"&&path===""||method==="POST"&&["checkout","portal","sync"].includes(path)))return error("billing_request_invalid",400);
  const forwarded=auth();if(forwarded instanceof NextResponse)return forwarded;
  if(!forwarded.has("Authorization"))return error("session_invalid",401);
  const abort=AbortSignal.any([request.signal,AbortSignal.timeout(35000)]);
  try{
    let body:unknown;
    if(method==="POST"){
      if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get("content-type")??""))return error("billing_request_invalid",400);
      body=await boundedJson(request,1024,abort);
      if(!record(body)||!(path==="checkout"?exact(body,["interval"])&&["MONTH","YEAR"].includes(String(body.interval)):exact(body,[])))return error("billing_request_invalid",400);
    }
    const base=ciBackendOrigin();
    if(!base)return error("billing_unavailable");
    const response=await fetch(base+"/api/account/billing"+(path?"/"+path:""),{method,headers:forwarded,cache:"no-store",redirect:"error",signal:abort,
      ...(body!==undefined?{body:JSON.stringify(body)}:{})});
    if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(response.headers.get("content-type")??""))return error("billing_unavailable");
    const data=await boundedJson(response,32768,abort);
    if(!response.ok){
      if(!record(data)||!billingCodes.includes(data.error as BillingCode)||!Object.keys(data).every(k=>["error","requestId"].includes(k))
        ||data.requestId!==undefined&&!(typeof data.requestId==="string"&&/^[a-f0-9-]{36}$/.test(data.requestId)))return error("billing_unavailable");
      const out=error(data.error as BillingCode,[400,401,403,404,409,429,503].includes(response.status)?response.status:503,typeof data.requestId==="string"?data.requestId:undefined);
      if(response.status===429)out.headers.set("Retry-After","900");
      return out;
    }
    if(path==="checkout"||path==="portal"){if(!stripeDestination(data,path==="portal"))return error("billing_unavailable");}
    else if(!billingSnapshot(data))return error("billing_unavailable");
    return NextResponse.json(data,{headers});
  }catch{return error("billing_unavailable");}
}
