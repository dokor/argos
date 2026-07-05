export type Report = {
  generatedAt: string;
  domain: string;
  url: string;
  site: {
    title?: string;
    logoUrl?: string;
  };
  scores: {
    global: number;
    /** Part des modules réellement évalués (0-100). Analyse partielle si < 100. */
    completeness?: number | null;
    byCategory: CategoryScore[];
  };
  summary: {
    oneLiner: string;
    priorities: PriorityItem[];
  };
  issues: Issue[];
  tech?: TechSummary;
  /** Présent uniquement si une protection anti-bot a été détectée (analyse partielle). */
  antiBot?: { detected: boolean; vendor?: string | null } | null;
};

export type TechSummary = {
  cms?: {
    name?: string;
    confidence?: number;
  };
  frontendFramework?: {
    name?: string;
    confidence?: number;
  };
  nextJs?: {
    isNext?: boolean;
    confidence?: number;
    router?: "app" | "pages" | "unknown";
    buildId?: string | null;
    version?: {
      exact?: string | null;
      min?: string | null;
      max?: string | null;
      guess?: string | null;
      guessConfidence?: number | null;
      method?: string | null;
    };
    evidence?: string[];
  };
};

export type Effort = "XS" | "S" | "M" | "L";
export type Severity = "critical" | "important" | "opportunity" | "info";

export type CategoryScore = {
  key: string;
  label: string;
  score: number; // 0-100
  issues: number;
};

export type PriorityItem = {
  severity: "critical" | "important" | "opportunity";
  title: string;
  impact: string;
  effort?: Effort;
};

export type Issue = {
  id: string;
  categoryKey: string;
  /** Toutes les catégories métier auxquelles le point appartient (ex. ["security","ssl"]). */
  categoryKeys?: string[];
  module?: string;
  severity: "critical" | "important" | "info";
  title: string;
  impact: string;
  evidence?: string;
  recommendation: string;
  effort?: Effort;
};

