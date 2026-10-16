import { NextRequest, NextResponse } from "next/server";
import { sameOrigin, smallJson } from "@/lib/analytics/server";
import { trafficPayload } from "@/lib/analytics/traffic";
import { TRAFFIC_CONSENT, TRAFFIC_VISIT, trafficCookie, trafficEnabled } from "@/lib/analytics/traffic-server";
export async function POST(request:NextRequest){
  const response=new NextResponse(null,{status:204,headers:{"Cache-Control":"private, no-store"}});
  if(!trafficEnabled()||!sameOrigin(request)||request.cookies.get(TRAFFIC_CONSENT)?.value!=="granted"||/bot|crawler|spider|headless|lighthouse|monitor/i.test(request.headers.get("user-agent")??""))return response;
  let value;try{value=trafficPayload(await smallJson(request));}catch{return new NextResponse(null,{status:400});}
  if(!value)return new NextResponse(null,{status:400});
  const visit=request.cookies.get(TRAFFIC_VISIT)?.value!=="1";
  try{
    const upstream=await fetch((process.env.API_BASE??"http://api-backend:8081")+"/api/traffic-analytics",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+process.env.ADMIN_API_TOKEN},body:JSON.stringify({...value,visit}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(500)});
    if(visit&&upstream.status===204)response.cookies.set(TRAFFIC_VISIT,"1",trafficCookie());
  }catch{/* A missing statistic must not interrupt navigation. */}
  return response;
}
