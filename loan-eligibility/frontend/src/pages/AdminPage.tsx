import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState, ErrorState, PageHeader, PageLoader, Stat } from "@/components/Feedback";
import { Badge, toneFor } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { LOAN_LABELS } from "@/lib/loanIcons";
import type { Metrics } from "@/lib/types";
import { TONE, dateLabel, inr, inrShort } from "@/lib/utils";

const axis = { fontSize: 12, fill: "#667085" };
const FEATURE = { dti: "Debt-to-income", credit_score: "Credit score", lti: "Loan vs. income", log_income: "Income", log_loan: "Loan amount", interest_rate: "Interest rate", tenure_years: "Tenure",
  employment_years: "Work experience", age: "Age", ltv: "Loan-to-value", savings_ratio: "Savings vs. loan", dependents: "Dependents", turnover_ratio: "Turnover vs. loan", business_years: "Years in business", co_income_ratio: "Co-applicant income" } as Record<string, string>;
const VERDICT = { approved: "Likely approved", review: "Needs review", unlikely: "Unlikely" } as const;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function Panel({ title, note, children, className }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return <Card className={className}><CardHeader><CardTitle>{title}</CardTitle>{note && <p className="text-sm text-muted">{note}</p>}</CardHeader><CardContent>{children}</CardContent></Card>;
}

export default function AdminPage() {
  const [filter, setFilter] = useState("");
  const [shown, setShown] = useState(15);
  const navigate = useNavigate();
  const stats = useAsync(() => api.analytics(), []);
  const apps = useAsync(() => api.adminPredictions(filter || undefined), [filter]);
  if (stats.loading) return <PageLoader label="Crunching the numbers" />;
  if (stats.error || !stats.data) return <ErrorState message={stats.error ?? "Couldn't load analytics."} onRetry={stats.reload} />;

  const d = stats.data, m = d.model;
  if (!d.totals.predictions) return (<><PageHeader title="Analytics" /><EmptyState title="No applications yet" body="Charts appear as soon as applicants run their first check. To load sample data, run python seed_demo.py in the backend folder." /></>);

  const histo = d.probability_histogram.map((b, i) => ({ ...b, fill: i < 4 ? TONE.unlikely.hex : i < 7 ? TONE.review.hex : TONE.approved.hex }));
  const risk = d.risk_distribution.map((r) => ({ name: `${r.risk[0].toUpperCase()}${r.risk.slice(1)} risk`, value: r.count, fill: TONE[r.risk].hex }));
  const models = [["Logistic regression", m.logistic_regression], ["Random forest", m.random_forest], ["Ensemble (used)", m.ensemble]] as [string, Metrics | undefined][];
  const features = (m.top_features ?? []).map((f) => ({ ...f, label: FEATURE[f.feature] ?? f.feature, importance: +(f.importance * 100).toFixed(1) }));
  const heuristic = m.mode === "heuristic";

  return (
    <>
      <PageHeader title="Analytics" subtitle={heuristic
        ? "Application activity. New estimates currently use a demo-only synthetic heuristic; trained model metrics are unavailable."
        : "How applicants are using LoanLens and how the models are performing."} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Applicants" value={d.totals.users} />
        <Stat label="Applications checked" value={d.totals.predictions} />
        <Stat label="Likely approved" value={`${d.totals.approval_rate}%`} note="Share scoring 70% or higher" />
        <Stat label="Average loan size" value={inrShort(d.totals.avg_amount)} note={`Average chance ${d.totals.avg_probability}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Applications per day" note="Last 30 days" className="lg:col-span-2">
          <div className="h-60" role="img" aria-label="Applications per day"><ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.daily} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="#e4e7ec" />
              <XAxis dataKey="date" tickFormatter={(x: string) => dateLabel(x, { day: "numeric", month: "short" })} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
              <Tooltip labelFormatter={(x) => dateLabel(String(x))} formatter={(v) => [String(v), "Applications"]} />
              <Area dataKey="count" stroke="#1f5fbf" strokeWidth={2} fill="#e8f0fc" />
            </AreaChart>
          </ResponsiveContainer></div>
        </Panel>

        <Panel title="Volume and approval by loan type" note="Bars show applications. The line shows the share likely approved.">
          <div className="h-64" role="img" aria-label="Applications and approval rate by loan type"><ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={d.by_loan_type} margin={{ left: -16, right: -8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="#e4e7ec" />
              <XAxis dataKey="label" tickFormatter={(x: string) => x.replace(" Loan", "")} tick={axis} axisLine={false} tickLine={false} />
              <YAxis yAxisId="n" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
              <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tickFormatter={(x: number) => `${x}%`} tick={axis} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, n) => [n === "Likely approved" ? `${v}%` : String(v), String(n)]} cursor={{ fill: "#f4f5f7" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="n" dataKey="count" name="Applications" fill="#c9d8f2" radius={[4, 4, 0, 0]} />
              <Line yAxisId="p" dataKey="approval_rate" name="Likely approved" stroke="#12805c" strokeWidth={2.5} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer></div>
        </Panel>

        <Panel title="Risk mix" note="Share of applications by risk level">
          <div className="h-64" role="img" aria-label="Risk distribution"><ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={risk} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" stroke="#fff" strokeWidth={2} label={({ value }) => String(value)}>{risk.map((r) => <Cell key={r.name} fill={r.fill} />)}</Pie>
              <Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart>
          </ResponsiveContainer></div>
        </Panel>

        <Panel title="Approval chance spread" note="How many applications fall in each 10-point band">
          <div className="h-56" role="img" aria-label="Histogram of approval chances"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={histo} margin={{ left: -20, right: 4, top: 8 }}>
              <CartesianGrid vertical={false} stroke="#e4e7ec" />
              <XAxis dataKey="range" tick={axis} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [String(v), "Applications"]} labelFormatter={(r) => `${r}%`} cursor={{ fill: "#f4f5f7" }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>{histo.map((h) => <Cell key={h.range} fill={h.fill} />)}</Bar>
            </BarChart>
          </ResponsiveContainer></div>
        </Panel>

        {!heuristic && <Panel title="What the Random Forest relies on" note="Share of the model's splits driven by each feature">
          <div className="h-56" role="img" aria-label="Top feature importances"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={features.slice(0, 7)} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" tickFormatter={(x: number) => `${x}%`} tick={axis} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12, fill: "#101828" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v}%`, "Importance"]} cursor={{ fill: "#f4f5f7" }} />
              <Bar dataKey="importance" fill="#153a66" radius={4} barSize={16} />
            </BarChart>
          </ResponsiveContainer></div>
        </Panel>}

        {!heuristic && <Panel title="Model performance" note={`Hold-out test, ${m.samples?.toLocaleString("en-IN")} ${m.data_source} applicants`} className="lg:col-span-2">
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-muted"><tr><th className="py-2 font-medium">Model</th>{["Accuracy", "Precision", "Recall", "F1", "ROC AUC"].map((h) => <th key={h} className="font-medium">{h}</th>)}</tr></thead>
            <tbody>{models.map(([name, s]) => s && (
              <tr key={name} className="border-t border-line"><td className="py-2.5 font-semibold">{name}</td>{[s.accuracy, s.precision, s.recall, s.f1, s.roc_auc].map((x, i) => <td key={i} className="tabular-nums">{pct(x)}</td>)}</tr>
            ))}</tbody>
          </table></div>
        </Panel>}
      </div>

      <div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-semibold">Recent applications</h2>
        <Select aria-label="Filter by loan type" value={filter} onChange={(e) => { setFilter(e.target.value); setShown(15); }} className="w-48"><option value="">All loan types</option>{Object.entries(LOAN_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
      </div>
      {apps.loading ? <PageLoader /> : apps.error || !apps.data ? <ErrorState message={apps.error ?? "Couldn't load applications."} onRetry={apps.reload} /> : (
        <Card className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-left text-muted"><tr><th className="px-5 py-3 font-medium">Applicant</th><th className="font-medium">Loan</th><th className="font-medium">Amount</th><th className="font-medium">Chance</th><th className="font-medium">Outcome</th><th className="px-5 font-medium">Date</th></tr></thead>
          <tbody>{apps.data.predictions.slice(0, shown).map((r) => (
            <tr key={r.id} onClick={() => navigate(`/results/${r.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-paper">
              <td className="px-5 py-3"><span className="font-semibold">{r.user?.name}</span><span className="block text-xs text-muted">{r.user?.email}</span></td>
              <td>{LOAN_LABELS[r.loan_type]}</td><td className="tabular-nums">{inr(r.loan_amount)}</td><td className="font-semibold tabular-nums">{r.probability.toFixed(0)}%</td>
              <td><Badge tone={toneFor(r.verdict)}>{VERDICT[r.verdict]}</Badge></td><td className="px-5 text-muted">{dateLabel(r.created_at)}</td>
            </tr>
          ))}</tbody>
        </table>{apps.data.predictions.length > shown && <div className="border-t border-line p-3 text-center"><button onClick={() => setShown((n) => n + 20)} className="cursor-pointer text-sm font-semibold text-primary hover:underline">Show more ({apps.data.predictions.length - shown} left)</button></div>}</Card>
      )}
    </>
  );
}
