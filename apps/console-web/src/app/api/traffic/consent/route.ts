import { NextRequest, NextResponse } from "next/server";
import { sameOrigin, smallJson } from "@/lib/analytics/server";
import { TRAFFIC_CONSENT, TRAFFIC_VISIT, trafficCookie, trafficEnabled } from "@/lib/analytics/traffic-server";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){const choice=request.cookies.get(TRAFFIC_CONSENT)?.value;return NextResponse.json({enabled:trafficEnabled(),choice:["granted","refused"].includes(choice??"")?choice:"unset"},{headers:{"Cache-Control":"private, no-store"}});}
export async function POST(request:NextRequest){
  if(!sameOrigin(request))return new NextResponse(null,{status:403});
  let body;try{body=await smallJson(request);}catch{return new NextResponse(null,{status:400});}
  if(!body||typeof body!=="object"||Object.keys(body).join()!=="choice"||!["granted","refused"].includes(String((body as {choice:unknown}).choice)))return new NextResponse(null,{status:400});
  const choice=(body as {choice:string}).choice;
  const response=new NextResponse(null,{status:204,headers:{"Cache-Control":"no-store"}});
  response.cookies.set(TRAFFIC_CONSENT,choice,trafficCookie());
  if(choice==="refused")response.cookies.set(TRAFFIC_VISIT,"",{...trafficCookie(),maxAge:0});
  return response;
}
