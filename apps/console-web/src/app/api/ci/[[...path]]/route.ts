import { NextRequest } from "next/server";
import { ciMachineProxy } from "@/lib/ci-machine-proxy";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{path?:string[]}>};
async function proxy(request:NextRequest,context:Context){return ciMachineProxy(request,(await context.params).path??[]);}
export {proxy as GET,proxy as POST,proxy as DELETE,proxy as PUT,proxy as PATCH,proxy as OPTIONS,proxy as HEAD};
