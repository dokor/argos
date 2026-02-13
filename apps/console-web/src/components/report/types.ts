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

