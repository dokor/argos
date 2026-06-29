"use client";

import { useLang } from "@/lib/i18n/LangContext";

export default function ErrorReport({ error }: { error: Error }) {
  const { t } = useLang();
  const te = t.report.error;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="rounded-2xl border bg-card p-6">
        <div className="text-lg font-semibold">{te.title}</div>
        <div className="mt-2 text-sm text-muted-foreground">{error.message}</div>
        <a href="/" className="mt-4 inline-block rounded-xl border bg-background px-4 py-2 text-sm font-semibold">
          {te.back}
        </a>
      </div>
    </div>
  );
}
