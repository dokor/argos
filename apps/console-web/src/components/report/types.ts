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
    globalAvailable?: boolean | null;
    calculation?: {
      scoringVersion: number;
      scoringFingerprint?: string | null;
      domains: {
        key: string; score: number; maxScore: number; ratio: number; effectiveWeight: number;
      }[];
    } | null;
    /** Part des modules réellement évalués (0-100). Analyse partielle si < 100. */
    completeness?: number | null;
    byCategory: CategoryScore[];
  };
  summary: {
    oneLiner: string;
    priorities: PriorityItem[];
    ai?: {
      fr: AiSummaryLocale;
      en: AiSummaryLocale;
    } | null;
  };
  issues: Issue[];
  tech?: TechSummary;
  /** Présent uniquement si une protection anti-bot a été détectée (analyse partielle). */
  antiBot?: { detected: boolean; vendor?: string | null } | null;
  accessibilityEvidence?: AccessibilityEvidence | null;
  accessibilityCompliance?: AccessibilityCompliance | null;
};

export type AccessibilityEvidence = {
  version: string;
  mappingVersion: string;
  sourceVersion?: string | null;
  coverage: "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
  referencedAudits: number;
  statusCounts: Partial<Record<"PASS" | "FAIL" | "MANUAL" | "NOT_APPLICABLE" | "NOT_TESTED" | "ERROR", number>>;
  failedAudits: number;
  reportedElements: number;
  elementCountComplete: boolean;
  surfacedFindings: number;
  truncated: boolean;
  findings: Array<{
    id: string;
    source: string;
    kind: "IMAGE_ALTERNATIVE" | "CONTRAST" | "ACCESSIBLE_NAME" | "LANGUAGE" | "OTHER";
    severity: "LOW" | "MEDIUM" | "HIGH";
    score?: number | null;
    reportedElements?: number | null;
    wcagCriteria: string[];
  }>;
};

export type AccessibilityCompliance = {
  accessibilityComplianceVersion: string;
  rulesValidated: boolean;
  scopes: Array<"POTENTIALLY_EAA" | "POTENTIALLY_ARTICLE_47" | "OUT_OF_SCOPE" | "UNKNOWN">;
  confidence: "LOW" | "HIGH" | "UNKNOWN";
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
  riskReason: "RULES_PENDING" | "SCOPE_UNKNOWN" | "COLLECTION_INCOMPLETE" | "FAILED_AUDITS" | "NO_DETECTED_FAILURE" | "OUTSIDE_SCOPE";
  signals: Array<{ code: string; provenance: "OBSERVED" | "DECLARED" | "VERIFIED"; value: boolean }>;
  missingInformation: string[];
  references: Array<{ title: string; url: string }>;
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


export type AiSummaryLocale = {
  headline: string;
  summary: string;
  keyPoints: string[];
};
