"use client";

import { useLang } from "@/lib/i18n/LangContext";

const MALT_PROFILE_URL = "https://www.malt.fr/profile/antoinelelouet";

export default function AuthorCredit({ className }: { className?: string }) {
  const { t } = useLang();

  return (
    <span>
      {t.landing.footer.builtPrefix}{" "}
      <a
        className={className}
        href={MALT_PROFILE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t.landing.footer.maltProfile}
      </a>
    </span>
  );
}
