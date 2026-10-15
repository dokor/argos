import type { Metadata } from "next";
import copy from "@/lib/i18n/en.json";
import AccountView from "@/components/account/AccountView";
export const metadata: Metadata = { title: copy.account.authTitles["reset"], robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function Page() { return <AccountView mode="reset" />; }
