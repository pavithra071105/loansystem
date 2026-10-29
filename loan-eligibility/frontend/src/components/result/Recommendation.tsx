import { ArrowUpRight, CheckCircle2, Lightbulb, TriangleAlert } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import type { Result } from "@/lib/types";
import { inr, inrShort, months } from "@/lib/utils";

export function Recommendation({ result, requested, tenure }: { result: Result; requested: number; tenure: number }) {
  const rec = result.recommendation;
  const same = Math.abs(rec.amount - requested) < 1 && rec.tenure_months === tenure;
  const headline =
    rec.status === "fits" ? (rec.amount > requested * 1.02 ? `You could borrow up to ${inr(rec.amount)}` : "Your requested amount fits your profile")
    : rec.status === "reduce" ? `Aim for ${inr(rec.amount)} to improve your odds`
    : "No amount we tested is a safe fit yet";
  const Icon = rec.status === "fits" ? CheckCircle2 : TriangleAlert;
  const tone = rec.status === "fits" ? "text-good bg-good-soft" : rec.status === "reduce" ? "text-warn bg-warn-soft" : "text-bad bg-bad-soft";
  const crossesThreshold = result.probability < 70 && rec.probability >= 70 && rec.dti <= 50;
  const demoMode = result.model.mode === "heuristic";
  const scenarios = [
    {
      label: "Your current request",
      amount: requested,
      tenure,
      emi: result.emi,
      interest: result.total_interest,
      dti: result.affordability.dti,
      probability: result.probability,
    },
    {
      label: "Suggested scenario",
      amount: rec.amount,
      tenure: rec.tenure_months,
      emi: rec.emi,
      interest: rec.total_interest,
      dti: rec.dti,
      probability: rec.probability,
    },
  ];

  const chart = rec.requested_tenure_options.map((o) => ({ ...o, label: months(o.tenure_months).replace(" months", " mo").replace(" years", " yr") }));
  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="mb-4">
            <h3 className="text-lg font-semibold">What would change your outcome?</h3>
            <p className="mt-1 text-sm text-muted">
              {crossesThreshold
                ? `This suggested amount and tenure move the ${demoMode ? "demo score" : "estimate"} across the 70% threshold.`
                : rec.probability >= 70 && rec.dti <= 50
                  ? `The suggested scenario stays above the 70% threshold. Compare the trade-offs before choosing.`
                  : `The best tested scenario improves the estimate, but does not meet both the 70% score and 50% debt-to-income guideposts.`}
              {demoMode && " This is an illustrative demo result, not a lender decision."}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {scenarios.map((scenario, index) => {
              const meetsGuideposts = scenario.probability >= 70 && scenario.dti <= 50;
              return (
                <section key={scenario.label} className={`rounded-xl border p-4 ${index === 1 ? "border-primary/30 bg-paper" : "border-line"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold">{scenario.label}</h4>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meetsGuideposts ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`}>
                      {meetsGuideposts ? "Meets demo guideposts" : "Below demo guideposts"}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tabular-nums">{inr(scenario.amount)}</p>
                  <p className="text-sm text-muted">{months(scenario.tenure)} repayment</p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
                    {[
                      ["Monthly EMI", inr(scenario.emi)],
                      ["Total interest", inr(scenario.interest)],
                      [demoMode ? "Demo score" : "Estimated chance", `${scenario.probability.toFixed(1)}%`],
                      ["Debt-to-income", `${scenario.dti.toFixed(1)}%`],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted">{label}</dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">The 70% score and 50% debt-to-income guideposts are for comparing illustrative scenarios only; they do not represent a lender's approval criteria.</p>
        </CardContent>
      </Card>

      <Card className={`flex flex-wrap items-center gap-5 border-0 p-5 ${tone}`}>
        <Icon className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-semibold text-ink">{headline}</h3>
          <p className="mt-1 text-sm text-ink/75">
            {rec.status === "not_viable"
              ? `The best result we found is ${inr(rec.amount)} over ${months(rec.tenure_months)} at ${rec.probability.toFixed(0)}%. Work through the improvements below, then apply again.`
              : same ? `Over ${months(rec.tenure_months)}, your EMI would be ${inr(rec.emi)} with a ${rec.probability.toFixed(0)}% approval chance.`
              : `Over ${months(rec.tenure_months)}, your EMI would be ${inr(rec.emi)} with a ${rec.probability.toFixed(0)}% approval chance and ${inr(rec.total_interest)} total interest.`}
          </p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold">Repayment period for {inr(requested)}</h3>
            <p className="mb-3 text-sm text-muted">Longer periods lower the EMI and raise approval chances, but you pay more interest. Best balance: {months(rec.best_tenure_for_requested)}.</p>
            <div className="h-64" role="img" aria-label="EMI and approval chance for each repayment period">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e4e7ec" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="emi" tickFormatter={(v: number) => inrShort(v)} tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} width={56} />
                  <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v, name) => (name === "Monthly EMI" ? inr(Number(v)) : `${Number(v).toFixed(1)}%`)} cursor={{ fill: "#f4f5f7" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="emi" dataKey="emi" name="Monthly EMI" fill="#c9d8f2" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="p" dataKey="probability" name="Approval chance" stroke="#1f5fbf" strokeWidth={2.5} dot={{ r: 4, fill: "#1f5fbf" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h3 className="flex items-center gap-2 text-lg font-semibold"><Lightbulb className="size-5 text-marigold" />Ways to improve</h3>
            {rec.levers.length ? (
              <ul className="mt-3 space-y-3">
                {rec.levers.map((l) => (
                  <li key={l.label} className="flex items-start justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                    <span className="text-sm font-semibold">{l.label}</span>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-good"><ArrowUpRight className="size-4" />+{l.gain.toFixed(0)} {Math.round(l.gain) === 1 ? "pt" : "pts"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-muted">Your profile is already strong. None of the changes we tested would move your chances by much.</p>}
            <p className="mt-4 text-xs text-muted">Comfortable borrowing limit at your current EMI burden: {inr(result.affordability.comfortable_max_loan)}. Stretch limit: {inr(result.affordability.stretch_max_loan)}.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
