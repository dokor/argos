"use client";

import Link from "@/components/LocalizedLink";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import ArgosIcon from "@/components/ArgosIcon";
import s from "./ReportHeader.module.scss";
import { useLang } from "@/lib/i18n/LangContext";
import {usePathname} from "next/navigation";
import FeedbackButton from "@/components/feedback/FeedbackButton";
import type { FeedbackReference } from "@/lib/feedback-request";

export default function ReportHeader({signedIn=false,feedbackReference}:{signedIn?:boolean;feedbackReference?:FeedbackReference}) {
  const { t,lang } = useLang();
  const path=usePathname(),destination=encodeURIComponent(path||"/account");

  return (
    <header className={s.header}>
      <div className={s.inner}>
        <Link href="/" className={s.brand}>
          <ArgosIcon size={20} className={s.brandIcon} />
          <span className={s.brandName}>{t.nav.logo}</span>
        </Link>

        <div className={s.right}>
          <div className={s.account}>{signedIn?<Link href="/account">{lang==="fr"?"Mon compte":"My account"}</Link>:<><Link href={"/account/sign-in?returnTo="+destination}>{lang==="fr"?"Se connecter":"Sign in"}</Link><Link className={s.register} href={"/account/register?returnTo="+destination}>{lang==="fr"?"Créer un compte":"Create an account"}</Link></>}</div>
          <FeedbackButton variant="icon" reference={feedbackReference}/>
          <ThemeToggle />
          <LangToggle />
        </div>
      </div>
    </header>
  );
}
