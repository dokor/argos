import { requestMetadata } from "@/lib/i18n/server";
import copy from "@/lib/i18n/en.json";
import AccountView from "@/components/account/AccountView";
export async function generateMetadata() { return requestMetadata({ title: copy.account.authTitles["forgot"], robots: { index: false, follow: false }, referrer: "no-referrer" }); }
export default function Page() { return <AccountView mode="forgot" />; }
