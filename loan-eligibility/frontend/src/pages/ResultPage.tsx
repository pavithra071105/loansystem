import { ArrowLeft, Download, FilePlus2, FlaskConical, Lightbulb, Scale, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorState, PageLoader, Spinner } from "@/components/Feedback";
import { ProbabilityGauge } from "@/components/ProbabilityGauge";
import { FactorChart } from "@/components/result/FactorChart";
import { Recommendation } from "@/components/result/Recommendation";
import { StressChart } from "@/components/result/StressChart";
import { WhatIf } from "@/components/result/WhatIf";
import { Badge, toneFor } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { cn, dateLabel, inr, months, TONE } from "@/lib/utils";

type Tab = "why" | "recommend" | "stress" | "whatif";

export default function ResultPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("why");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const pred = useAsync(() => api.prediction(id), [id]);
  const types = useAsync(() => api.loanTypes(), []);

  if (pred.loading || types.loading) return <PageLoader label="Loading your result" />;
  if (pred.error || types.error || !pred.data || !types.data) return <ErrorState message={pred.error ?? types.error ?? "We couldn't load this result."} onRetry={() => { pred.reload(); types.reload(); }} />;

  const p = pred.data.prediction, r = p.result;
  const loan = types.data.loan_types.find((l) => l.key === p.loan_type)!;
  const tone = TONE[r.verdict.code];
  const demoApproved = r.verdict.code === "approved";
  const back = user?.role === "admin" ? "/admin" : "/history";

  const download = async () => {
    setPdfBusy(true); setPdfError("");
    try { await api.downloadReport(p.id); } catch { setPdfError("The PDF couldn't be created. Try again."); } finally { setPdfBusy(false); }
  };

  return (
    <>
      <Link to={back} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />{user?.role === "admin" ? "Back to analytics" : "Back to history"}</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{inr(p.loan_amount)} {r.loan_label.toLowerCase()}</h1>
          <p className="mt-1 text-sm text-muted">{months(p.tenure_months)} at {r.interest_rate}% a year, checked on {dateLabel(p.created_at)}{p.user ? ` for ${p.user.name}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={download} disabled={pdfBusy}>{pdfBusy ? <Spinner /> : <Download className="size-4" />}Download PDF report</Button>
          {user?.role === "applicant" && <Link to="/apply" className={buttonVariants()}><FilePlus2 className="size-4" />New application</Link>}
        </div>
      </div>
      {pdfError && <p role="alert" className="mb-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{pdfError}</p>}

      <Card className="mb-6 overflow-hidden">
        <div className="grid items-center gap-6 p-6 md:grid-cols-[320px_1fr] md:gap-10 md:p-8">
          <ProbabilityGauge value={r.probability} tone={r.verdict.code} className="mx-auto" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={cn("text-3xl font-semibold", tone.text)}>{r.model.mode === "heuristic" ? `Demo outcome: ${demoApproved ? "Approved" : "Rejected"}` : r.verdict.label}</h2>
              <Badge tone={toneFor(r.risk.level)}>{r.risk.label}</Badge>
            </div>
            <p className="mt-2 max-w-lg text-sm text-muted">
              {r.model.mode === "heuristic" ? `This illustrative estimate ${demoApproved ? "meets" : "falls below"} the 70% demo threshold. It is not a lender's decision.`
                : r.verdict.code === "approved" ? "Your profile clears our approval threshold for this request."
                : r.verdict.code === "review" ? "You're close. A lender would likely want a closer look, and small changes could tip it."
                : "This request is unlikely to be approved as it stands. The recommendation tab shows what to change."}
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {[["Monthly EMI", inr(r.emi)], ["Total interest", inr(r.total_interest)], ["Debt-to-income", `${r.affordability.dti}%`], ["Affordability", r.affordability.status[0].toUpperCase() + r.affordability.status.slice(1)]].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums">{v}</dd></div>
              ))}
            </dl>
            {r.model_probabilities && <div className="mt-6 space-y-2 border-t border-line pt-4">
              {([["Logistic regression", r.model_probabilities.logistic_regression], ["Random forest", r.model_probabilities.random_forest]] as const).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3 text-xs"><span className="w-32 text-muted">{k}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-line"><div className="h-full rounded-full bg-navy-soft" style={{ width: `${v}%` }} /></div>
                  <span className="w-9 text-right font-semibold tabular-nums">{v.toFixed(0)}%</span></div>
              ))}
              <p className="text-xs text-muted">Your score averages both models.</p>
            </div>}
          </div>
        </div>
      </Card>

      {r.model.mode === "heuristic" && <div role="status" className="mb-6 rounded-xl border border-warn/30 bg-warn-soft p-4 text-sm text-ink">
        <p className="font-semibold">Demo-only estimate — not a trained model or lender decision</p>
        <p className="mt-1">The trained prediction runtime isn’t available, so this result uses a transparent heuristic based on synthetic underwriting rules. Treat the estimate as illustrative only.</p>
      </div>}

      <Tabs<Tab> value={tab} onChange={setTab} className="mb-6" items={[
        { id: "why", label: "Why this result", icon: <Scale className="size-4" /> },
        { id: "recommend", label: "Recommendation", icon: <Lightbulb className="size-4" /> },
        { id: "stress", label: "Stress test", icon: <ShieldAlert className="size-4" /> },
        { id: "whatif", label: "What-if simulator", icon: <FlaskConical className="size-4" /> },
      ]} />

      {tab === "why" && (
        <Card><CardContent>
          <h3 className="text-lg font-semibold">What moved your approval chance</h3>
          <p className="mb-4 max-w-2xl text-sm text-muted">Each bar shows how many points a factor added to or took from your chance, compared with a typical applicant ({r.explanation.base_probability.toFixed(0)}%). Hover a bar for your value.</p>
          <FactorChart factors={r.explanation.factors} />
          <p className="mt-2 text-xs text-muted">{r.explanation.method}.</p>
        </CardContent></Card>
      )}
      {tab === "recommend" && <Recommendation result={r} requested={p.loan_amount} tenure={p.tenure_months} />}
      {tab === "stress" && (
        <Card><CardContent>
          <h3 className="text-lg font-semibold">Would you still qualify if things got harder?</h3>
          <p className="mb-4 max-w-2xl text-sm text-muted">We re-score your application under common shocks to income, rates and credit. Bars above the dashed line (70%) still pass.</p>
          <StressChart rows={r.stress} baseline={r.probability} />
        </CardContent></Card>
      )}
      {tab === "whatif" && <WhatIf prediction={p} loan={loan} />}

      <p className="mt-8 text-xs text-muted">{r.model.mode === "heuristic"
        ? "This is a demo-only heuristic estimate based on synthetic rules, not a trained prediction model or lender decision."
        : "This is an estimate from a demo model trained on synthetic data. It is not a credit decision."}</p>
    </>
  );
}
