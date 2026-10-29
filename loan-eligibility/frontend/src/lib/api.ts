import type { AffordResult, Analytics, EmiResult, LoanType, Prediction, PredictionSummary, WhatIfResult } from "./types";

export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) { headers.set("Content-Type", "application/json"); rest.body = JSON.stringify(json); }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...rest, headers });
  } catch {
    throw new ApiError("Unable to reach the loan service. Please try again later.", 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? "Something went wrong. Try again.", res.status, body.fields ?? {});
  }
  if (path.endsWith("/report") && res.headers.get("content-type")?.includes("application/pdf")) return res.blob() as Promise<T>;
  if (!res.headers.get("content-type")?.includes("json")) {
    throw new ApiError("The loan service is currently unavailable. Your account is signed in; please try loan features again later.", 503);
  }
  return res.json() as Promise<T>;
}

export const api = {
  loanTypes: () => request<{ loan_types: LoanType[] }>("/meta/loan-types"),
  predict: (loan_type: string, input: Record<string, string | number>) => request<{ prediction: Prediction }>("/predictions", { method: "POST", json: { loan_type, input } }),
  history: (loanType?: string) => request<{ predictions: PredictionSummary[] }>(`/predictions${loanType ? `?loan_type=${loanType}` : ""}`),
  prediction: (id: number | string) => request<{ prediction: Prediction }>(`/predictions/${id}`),
  remove: (id: number) => request<{ deleted: number }>(`/predictions/${id}`, { method: "DELETE" }),
  whatIf: (id: number, changes: Record<string, number | string>) => request<WhatIfResult>(`/predictions/${id}/what-if`, { method: "POST", json: { changes } }),
  emi: (b: { principal: number; rate: number; months: number }) => request<EmiResult>("/calculators/emi", { method: "POST", json: b }),
  affordability: (b: { monthly_income: number; existing_emi: number; rate: number; months: number }) => request<AffordResult>("/calculators/affordability", { method: "POST", json: b }),
  analytics: () => request<Analytics>("/admin/analytics"),
  adminPredictions: (loanType?: string) => request<{ predictions: PredictionSummary[] }>(`/admin/predictions${loanType ? `?loan_type=${loanType}` : ""}`),
  async downloadReport(id: number) {
    const blob = await request<Blob>(`/predictions/${id}/report`);
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `loan-eligibility-report-${id}.pdf` });
    a.click();
    URL.revokeObjectURL(url);
  },
};
