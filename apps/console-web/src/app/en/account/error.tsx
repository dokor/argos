"use client";
import AccountState from "@/components/connected/AccountState";
export default function ErrorPage({ retry }: { retry: () => void }) { return <AccountState kind="error" retry={retry}/>; }
