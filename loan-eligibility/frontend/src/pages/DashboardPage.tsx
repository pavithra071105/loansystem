import { ArrowRight, Calculator, FilePlus2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, ErrorState, PageHeader, PageLoader, Stat } from "@/components/Feedback";
import { Badge, toneFor } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { LOAN_ICONS, LOAN_LABELS } from "@/lib/loanIcons";
import { TONE, cn, dateLabel, inr, inrShort } from "@/lib/utils";

const ICON_FOR: Record<string, string> = { personal: "Wallet", home: "Home", education: "GraduationCap", vehicle: "Car", business: "Briefcase" };
const VERDICT = { approved: "Likely approved", review: "Needs review", unlikely: "Unlikely" } as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAsync(() => api.history(), []);
  if (loading) return <PageLoader />;
  if (error || !data) return <ErrorState message={error ?? "Couldn't load your dashboard."} onRetry={reload} />;

  const rows = data.predictions;
  const first = user?.name.split(" ")[0] ?? "";
  if (!rows.length)
    return (
      <>
        <PageHeader title={`Welcome, ${first}`} subtitle="Check how likely a lender is to approve you, and what you can do about it." />
        <EmptyState title="No applications yet" body="Run your first eligibility check. It takes about two minutes and doesn't affect your credit score."
          action={<Link to="/apply" className={buttonVariants()}><FilePlus2 className="size-4" />Start an application</Link>} />
      </>
    );

  const latest = rows[0];
  const chart = [...rows].reverse().slice(-12).map((r) => ({ id: r.id, date: dateLabel(r.created_at, { day: "numeric", month: "short" }), probability: r.probability, type: LOAN_LABELS[r.loan_type] }));
  return (
    <>
      <PageHeader title={`Welcome back, ${first}`} subtitle="Here's where your applications stand."
        actions={<Link to="/apply" className={buttonVariants()}><FilePlus2 className="size-4" />New application</Link>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Applications checked" value={rows.length} />
        <Stat label="Latest approval chance" value={`${latest.probability.toFixed(0)}%`} tone={TONE[latest.verdict].text} note={`${LOAN_LABELS[latest.loan_type]}, ${dateLabel(latest.created_at)}`} />
        <Stat label="Best approval chance" value={`${Math.max(...rows.map((r) => r.probability)).toFixed(0)}%`} />
        <Stat label="Average loan size" value={inrShort(rows.reduce((s, r) => s + r.loan_amount, 0) / rows.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="flex flex-col">
          <CardHeader><CardTitle>Approval chance over time</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="min-h-64 flex-1" role="img" aria-label="Line chart of your approval chances">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e4e7ec" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={70} stroke="#12805c" strokeDasharray="4 4" />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, "Approval chance"]} labelFormatter={(_, p) => p?.[0]?.payload?.type ?? ""} />
                  <Line dataKey="probability" stroke="#1f5fbf" strokeWidth={2.5} dot={{ r: 4, fill: "#1f5fbf", cursor: "pointer" }} activeDot={{ r: 6, onClick: (_: unknown, e: unknown) => { const id = (e as { payload?: { id: number } })?.payload?.id; if (id) navigate(`/results/${id}`); } }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-muted">The dashed line is where approval becomes likely (70%).</p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Recent checks</CardTitle></CardHeader>
            <CardContent className="space-y-1 pt-3">
              {rows.slice(0, 5).map((r) => {
                const Icon = LOAN_ICONS[ICON_FOR[r.loan_type]];
                return (
                  <Link key={r.id} to={`/results/${r.id}`} className="-mx-2 flex items-center gap-3 rounded-lg p-2 hover:bg-paper">
                    <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="size-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{inr(r.loan_amount)}</span><span className="block text-xs text-muted">{LOAN_LABELS[r.loan_type]}, {dateLabel(r.created_at)}</span></span>
                    <Badge tone={toneFor(r.verdict)}>{r.probability.toFixed(0)}%</Badge>
                  </Link>
                );
              })}
              <Link to="/history" className="flex items-center gap-1 pt-2 text-sm font-semibold text-primary hover:underline">See all history<ArrowRight className="size-4" /></Link>
            </CardContent>
          </Card>
          <Card className="bg-navy text-white">
            <CardContent>
              <Calculator className="mb-3 size-6 text-marigold" />
              <h3 className="text-lg font-semibold">Plan your EMI</h3>
              <p className="mt-1 text-sm text-white/70">Try different amounts and periods, or find out how much you can afford.</p>
              <Link to="/calculators" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-4")}>Open calculators</Link>
            </CardContent>
          </Card>
        </div>
      </div>
      <p className="sr-only">{VERDICT[latest.verdict]}</p>
    </>
  );
}
