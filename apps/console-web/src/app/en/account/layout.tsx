import { requestMetadata } from "@/lib/i18n/server";
import copy from "@/lib/i18n/en.json";
import AccountShell from "@/components/connected/AccountShell";
import AccountSession from "@/components/account/AccountSession";
export const dynamic = "force-dynamic";
export async function generateMetadata() { return requestMetadata({ title: copy.connected.workspace, robots: { index: false, follow: false }, referrer: "no-referrer" }); }
export default function Layout({ children }: { children: React.ReactNode }) { return <AccountSession><AccountShell>{children}</AccountShell></AccountSession>; }
