import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DynamicField } from "@/components/DynamicField";
import { ErrorState, PageHeader, PageLoader, Spinner } from "@/components/Feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { effectiveRate, emi } from "@/lib/finance";
import { useAsync } from "@/lib/hooks";
import { LOAN_ICONS } from "@/lib/loanIcons";
import type { Field, LoanType } from "@/lib/types";
import { cn, inr, inrShort, months } from "@/lib/utils";

const SECTIONS: { id: Field["section"]; title: string }[] = [
  { id: "person", title: "About you" },
  { id: "finance", title: "Income and credit" },
  { id: "loan", title: "Your loan" },
  { id: "details", title: "" },
];

function validate(loan: LoanType, v: Record<string, string>) {
  const errors: Record<string, string> = {};
  for (const f of loan.fields) {
    const raw = v[f.name];
    if (raw === "" || raw === undefined) { errors[f.name] = "This field is required."; continue; }
    if (f.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) errors[f.name] = "Enter a number.";
      else if (n < f.min! || n > f.max!) errors[f.name] = `Enter a value between ${f.min!.toLocaleString("en-IN")} and ${f.max!.toLocaleString("en-IN")}.`;
    }
  }
  if (!errors.down_payment && v.down_payment !== undefined && loan.asset_field && !errors[loan.asset_field]) {
    const asset = Number(v[loan.asset_field]), down = Number(v.down_payment), amount = Number(v.loan_amount);
    if (down > asset) errors.down_payment = "Down payment can't be more than the price.";
    else if (!errors.loan_amount && amount + down > asset) errors.loan_amount = "Loan plus down payment can't exceed the price.";
  }
  return errors;
}

export default function ApplyPage() {
  const { data, error, loading, reload } = useAsync(() => api.loanTypes(), []);
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const loan = data?.loan_types.find((l) => l.key === typeKey) ?? null;

  const choose = (l: LoanType) => {
    setTypeKey(l.key);
    setValues(Object.fromEntries(l.fields.map((f) => [f.name, String(f.default)])));
    setErrors({}); setFormError("");
  };

  const preview = useMemo(() => {
    if (!loan) return null;
    const amount = Number(values.loan_amount), tenure = Number(values.tenure_months), credit = Number(values.credit_score);
    if (!(amount > 0) || !(tenure > 0) || !Number.isFinite(credit)) return null;
    const rate = effectiveRate(loan.rate, credit);
    const pay = emi(amount, rate, tenure);
    const income = Number(values.monthly_income) + 0.5 * Number(values.co_applicant_income || 0);
    return { rate, pay, dti: income > 0 ? ((Number(values.existing_emi) + pay) / income) * 100 : 0, amount, tenure };
  }, [loan, values]);

  const submit = async () => {
    if (!loan) return;
    const found = validate(loan, values);
    setErrors(found);
    if (Object.keys(found).length) { setFormError("Check the highlighted fields."); document.getElementById(`f-${Object.keys(found)[0]}`)?.focus(); return; }
    setBusy(true); setFormError("");
    try {
      const payload = Object.fromEntries(loan.fields.map((f) => [f.name, f.type === "number" ? Number(values[f.name]) : f.options!.some((o) => typeof o.value === "number") ? Number(values[f.name]) : values[f.name]]));
      const { prediction } = await api.predict(loan.key, payload);
      navigate(`/results/${prediction.id}`);
    } catch (e) {
      if (e instanceof ApiError) { setFormError(e.message); setErrors(e.fields); } else setFormError("Something went wrong. Try again.");
      setBusy(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error ?? "Couldn't load loan types."} onRetry={reload} />;

  const step = loan ? 2 : 1;
  return (
    <>
      <PageHeader title="New application" subtitle={step === 1 ? "Start with the kind of loan you want. The next form adapts to it." : `Tell us about your ${loan!.label.toLowerCase()} request.`} />
      <ol className="mb-8 flex items-center gap-3 text-sm font-semibold" aria-label="Progress">
        {["Loan type", "Your details"].map((label, i) => (
          <li key={label} className={cn("flex items-center gap-2", step >= i + 1 ? "text-ink" : "text-muted")} aria-current={step === i + 1 ? "step" : undefined}>
            <span className={cn("grid size-6 place-items-center rounded-full text-xs", step > i + 1 ? "bg-good text-white" : step === i + 1 ? "bg-navy text-white" : "bg-line text-muted")}>{i + 1}</span>
            {label}{i === 0 && <ChevronRight className="size-4 text-muted" />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        {!loan ? (
          <motion.div key="pick" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.loan_types.map((l) => {
              const Icon = LOAN_ICONS[l.icon];
              return (
                <button key={l.key} onClick={() => choose(l)} className="group cursor-pointer rounded-xl border border-line bg-surface p-5 text-left transition-colors hover:border-primary hover:bg-primary-soft/40">
                  <span className="mb-4 grid size-11 place-items-center rounded-lg bg-primary-soft text-primary group-hover:bg-primary group-hover:text-white"><Icon className="size-5" /></span>
                  <h3 className="text-lg font-semibold">{l.label}</h3>
                  <p className="mt-1 min-h-10 text-sm text-muted">{l.tagline}</p>
                  <p className="mt-4 border-t border-line pt-3 text-xs text-muted">From {l.rate}% a year. Borrow {inrShort(l.min_amount)} to {inrShort(l.max_amount)}.</p>
                </button>
              );
            })}
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.18 }}
            className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              {SECTIONS.map((s) => {
                const fields = loan.fields.filter((f) => f.section === s.id);
                if (!fields.length) return null;
                return (
                  <Card key={s.id}>
                    <CardHeader><CardTitle>{s.title || `${loan.label} details`}</CardTitle></CardHeader>
                    <CardContent className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                      {fields.map((f) => <DynamicField key={f.name} field={f} value={values[f.name] ?? ""} error={errors[f.name]} onChange={(v) => setValues((p) => ({ ...p, [f.name]: v }))} />)}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-8">
              <Card>
                <CardHeader><CardTitle>Your request</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted">{loan.label}</p>
                  {preview ? (
                    <>
                      <p className="mt-3 font-display text-4xl font-semibold tabular-nums">{inr(preview.pay)}<span className="font-sans text-sm font-medium text-muted"> a month</span></p>
                      <dl className="mt-4 space-y-2 text-sm">
                        {[["Amount", inr(preview.amount)], ["Repayment", months(preview.tenure)], ["Interest rate", `${preview.rate}% a year`], ["Debt-to-income", `${preview.dti.toFixed(0)}%`]].map(([k, v]) => (
                          <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
                        ))}
                      </dl>
                    </>
                  ) : <p className="mt-3 text-sm text-muted">Fill in the amount and repayment period to see your EMI.</p>}
                </CardContent>
              </Card>
              {formError && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{formError}</p>}
              <Button size="lg" className="w-full" onClick={submit} disabled={busy}>{busy ? <><Spinner className="text-white" />Analysing</> : "Check my eligibility"}</Button>
              <Button variant="ghost" className="w-full" onClick={() => setTypeKey(null)} disabled={busy}><ArrowLeft className="size-4" />Change loan type</Button>
            </aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
