import copy from "@/lib/i18n/en.json";
import AccountShell from "@/components/connected/AccountShell";
import AccountSession from "@/components/account/AccountSession";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: copy.connected.workspace, robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function Layout({ children }: { children: React.ReactNode }) { return <AccountSession><AccountShell>{children}</AccountShell></AccountSession>; }
