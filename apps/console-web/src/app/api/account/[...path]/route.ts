import { NextRequest } from "next/server";
import { accountProxy } from "@/lib/account-proxy";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: NextRequest, context: Context) { return accountProxy(request, (await context.params).path); }
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
