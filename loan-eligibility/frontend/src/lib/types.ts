export type Role = "applicant" | "admin";
export interface User { id: number; name: string; email: string; role: Role }

export interface Option { value: string | number; label: string }
export interface Field {
  name: string; label: string; type: "number" | "select"; section: "person" | "finance" | "loan" | "details";
  min?: number; max?: number; step?: number; default: string | number; unit?: string; help?: string; options?: Option[]; integer?: boolean;
}
export interface LoanType {
  key: string; label: string; tagline: string; icon: string; rate: number; min_amount: number; max_amount: number;
  tenures: number[]; asset_field: string | null; fields: Field[];
}

export type VerdictCode = "approved" | "review" | "unlikely";
export type RiskLevel = "low" | "moderate" | "high";
export interface Verdict { code: VerdictCode; label: string }
export interface Risk { level: RiskLevel; label: string; score: number }
export interface Factor { feature: string; label: string; value: string; impact: number; direction: "up" | "down" }
export interface TenureOption { tenure_months: number; emi: number; probability: number; dti: number }
export interface Lever { label: string; probability: number; gain: number }
export interface StressRow { id: string; label: string; probability: number; change: number; dti: number; emi: number; verdict: VerdictCode }

export interface Result {
  loan_label: string; probability: number; verdict: Verdict; risk: Risk;
  model_probabilities: { logistic_regression: number; random_forest: number } | null;
  emi: number; interest_rate: number; total_interest: number; total_payment: number;
  affordability: { dti: number; emi_to_income: number; status: "comfortable" | "manageable" | "stretched"; comfortable_max_loan: number; stretch_max_loan: number };
  explanation: { base_probability: number; factors: Factor[]; method: string };
  recommendation: {
    status: "fits" | "reduce" | "not_viable"; amount: number; tenure_months: number; emi: number; probability: number;
    interest_rate: number; total_interest: number; dti: number; best_tenure_for_requested: number;
    requested_tenure_options: TenureOption[]; levers: Lever[];
  };
  stress: StressRow[];
  model: { trained_at: string | null; data_source: string; mode: "trained" | "heuristic" };
}

export interface PredictionSummary {
  id: number; loan_type: string; loan_amount: number; tenure_months: number; probability: number;
  verdict: VerdictCode; risk_level: RiskLevel; created_at: string; user?: { id: number; name: string; email: string };
}
export interface Prediction extends PredictionSummary { input: Record<string, string | number>; result: Result }

export interface Snapshot { probability: number; verdict: Verdict; risk: Risk; emi: number; dti: number; interest_rate: number }
export interface WhatIfResult { baseline: Snapshot; scenario: Snapshot; change: number }

export interface Metrics { accuracy: number; precision: number; recall: number; f1: number; roc_auc: number }
export interface Analytics {
  totals: { users: number; predictions: number; approval_rate: number; avg_probability: number; avg_amount: number };
  by_loan_type: { loan_type: string; label: string; count: number; approval_rate: number; avg_probability: number; avg_amount: number }[];
  risk_distribution: { risk: RiskLevel; count: number }[];
  verdicts: { verdict: VerdictCode; count: number }[];
  probability_histogram: { range: string; count: number }[];
  daily: { date: string; count: number; avg_probability: number | null }[];
  model: { mode?: "trained" | "heuristic"; trained_at?: string; samples?: number; data_source?: string; logistic_regression?: Metrics; random_forest?: Metrics; ensemble?: Metrics; top_features?: { feature: string; importance: number }[] };
}

export interface EmiResult { emi: number; total_payment: number; total_interest: number; schedule: { year: number; principal: number; interest: number; balance: number }[] }
export interface AffordResult { current_obligation_pct: number; comfortable: { max_total_obligations: number; emi_budget: number; max_loan: number }; stretch: { max_total_obligations: number; emi_budget: number; max_loan: number } }
