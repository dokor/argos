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
    byCategory: CategoryScore[];
  };
  summary: {
    oneLiner: string;
    priorities: PriorityItem[];
  };
  issues: Issue[];
  tech?: TechSummary;
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
  module?: string;
  severity: "critical" | "important" | "info";
  title: string;
  impact: string;
  evidence?: string;
  recommendation: string;
  effort?: Effort;
};

