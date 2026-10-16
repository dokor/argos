"use client";

import ArgosIcon from "@/components/ArgosIcon";
import { urlEasterEgg } from "@/lib/easter-eggs";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./EasterEggs.module.scss";

export default function AuditUrlEasterEgg({ url }: { url: string }) {
  const { t } = useLang();
  const egg = urlEasterEgg(url);
  return <div className={s.urlMessage} role="status" aria-atomic="true">
    {egg && <p key={egg}>
      <ArgosIcon size={24} className={egg === "argos" ? s.mirrorEye : undefined} />
      <span>{t.easterEggs.urls[egg]}</span>
    </p>}
  </div>;
}
