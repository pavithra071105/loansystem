import type { AffordResult, Analytics, EmiResult, LoanType, Prediction, PredictionSummary, User, WhatIfResult } from "./types";

const TOKEN_KEY = "loanlens.token";
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (json !== undefined) { headers.set("Content-Type", "application/json"); rest.body = JSON.stringify(json); }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...rest, headers });
  } catch {
    throw new ApiError("Can't reach the server. Check that the Flask API is running on port 5000.", 0);
  }
  if (res.status === 401 && token && !path.startsWith("/auth/")) onUnauthorized();
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? "Something went wrong. Try again.", res.status, body.fields ?? {});
  }
  return (res.headers.get("content-type")?.includes("json") ? res.json() : res.blob()) as Promise<T>;
}

export const api = {
  register: (b: { name: string; email: string; password: string }) => request<{ token: string; user: User }>("/auth/register", { method: "POST", json: b }),
  login: (b: { email: string; password: string }) => request<{ token: string; user: User }>("/auth/login", { method: "POST", json: b }),
  me: () => request<{ user: User }>("/auth/me"),
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
