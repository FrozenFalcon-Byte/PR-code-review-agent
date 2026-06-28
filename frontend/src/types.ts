export type Severity = "low" | "medium" | "high" | "critical";

export interface ReviewItem {
  title: string;
  description: string;
  file?: string;
  line?: string;
  severity: Severity;
}

export interface Suggestion {
  title: string;
  description: string;
  file?: string;
}

export interface ReviewOutput {
  bugs: ReviewItem[];
  security_issues: ReviewItem[];
  suggestions: Suggestion[];
  summary: string;
}

export interface ConflictResolution {
  file: string;
  conflict_summary: string;
  our_side: string;
  their_side: string;
  recommendation: string;
}

export interface ConflictReport {
  mergeable: boolean;
  mergeable_state: string;
  conflicts: ConflictResolution[];
  overall_strategy: string;
}

export interface FullReviewResponse {
  review: ReviewOutput;
  conflicts: ConflictReport;
  agent_prompt: string;
}

export interface ReviewWithPromptResponse {
  review: ReviewOutput;
  agent_prompt: string;
}

export type EndpointType = "full" | "review" | "conflicts" | "with-prompt";
