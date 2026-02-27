import { Badge } from "@/components/ui/badge";

type NextJsVersion = {
  exact?: string | null;
  min?: string | null;
  max?: string | null;
  guess?: string | null;
  guessConfidence?: number | null;
  method?: string | null;
};

type NextJsData = {
  isNext?: boolean;
  confidence?: number;
  router?: "app" | "pages" | "unknown" | string;
  buildId?: string | null;
  version?: NextJsVersion;
};

type TechData = {
  cms?: { name?: string; confidence?: number };
  frontendFramework?: { name?: string; confidence?: number };
  nextJs?: NextJsData;
};

function formatNextVersion(nextJs?: NextJsData) {
  const v = nextJs?.version;
  if (!v) return null;

  if (v.exact) return `v${v.exact}`;
  if (v.guess) return `~${v.guess}`;
  if (v.min) return `>=${v.min}`;
  return null;
}

export function TechBadges({ tech }: { tech?: TechData }) {
  if (!tech) return null;

  const cms = tech.cms?.name;
  const frontend = tech.frontendFramework?.name;
  const nextJs = tech.nextJs;

  const badges: { label: string; title?: string }[] = [];

  if (cms) {
    badges.push({ label: `CMS: ${cms}` });
  }

  if (nextJs?.isNext) {
    const router =
      nextJs.router === "app" ? "App" : nextJs.router === "pages" ? "Pages" : "Next";
    const ver = formatNextVersion(nextJs);

    badges.push({
      label: ver ? `Next.js · ${router} · ${ver}` : `Next.js · ${router}`,
      title: `confidence ${(nextJs.confidence ?? 0).toFixed(2)}`
    });
  } else if (frontend && frontend !== "unknown") {
    badges.push({ label: `Frontend: ${frontend}` });
  }

  // fallback si rien
  if (badges.length === 0) badges.push({ label: "Tech: unknown" });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {badges.slice(0, 3).map((b, idx) => (
        <Badge
          key={idx}
          variant="secondary"
          title={b.title}
          className="rounded-full px-3 py-1 text-xs"
        >
          {b.label}
        </Badge>
      ))}
    </div>
  );
}