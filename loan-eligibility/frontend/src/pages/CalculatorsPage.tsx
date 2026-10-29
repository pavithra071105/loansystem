import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorState, PageHeader } from "@/components/Feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { api } from "@/lib/api";
import { useLatest } from "@/lib/hooks";
import { cn, inr, inrShort } from "@/lib/utils";

type Tab = "emi" | "afford";
const axis = { fontSize: 12, fill: "#667085" };

function EmiCalculator() {
  const [v, setV] = useState({ principal: 1_000_000, rate: 9, years: 5 });
  const { out, error } = useLatest(v, (x) => api.emi({ principal: x.principal, rate: x.rate, months: x.years * 12 }));
  const set = (k: keyof typeof v) => (n: number) => setV((p) => ({ ...p, [k]: n }));
  const split = out ? [{ name: "Principal", value: v.principal, fill: "#1f5fbf" }, { name: "Interest", value: out.total_interest, fill: "#f2a900" }] : [];
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
      <Card><CardContent className="space-y-6">
        <Slider label="Loan amount" value={v.principal} min={50_000} max={20_000_000} step={50_000} display={inrShort(v.principal)} onChange={set("principal")} />
        <Slider label="Interest rate" value={v.rate} min={5} max={24} step={0.25} display={`${v.rate}% a year`} onChange={set("rate")} />
        <Slider label="Repayment period" value={v.years} min={1} max={30} step={1} display={`${v.years} ${v.years === 1 ? "year" : "years"}`} onChange={set("years")} />
      </CardContent></Card>
      {error ? <ErrorState message={error} /> : !out ? null : (
        <div className="space-y-6">
          <Card><CardContent className="grid gap-6 sm:grid-cols-[1fr_200px] sm:items-center">
            <div>
              <p className="text-sm text-muted">Monthly EMI</p>
              <p className="font-display text-5xl font-semibold tabular-nums">{inr(out.emi)}</p>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-muted">Total interest</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums">{inr(out.total_interest)}</dd></div>
                <div><dt className="text-muted">Total repayment</dt><dd className="mt-0.5 text-lg font-semibold tabular-nums">{inr(out.total_payment)}</dd></div>
              </dl>
            </div>
            <div className="h-44" role="img" aria-label="Principal versus interest"><ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={split} dataKey="value" innerRadius="60%" outerRadius="95%" strokeWidth={2} stroke="#fff">{split.map((s) => <Cell key={s.name} fill={s.fill} />)}</Pie>
                <Tooltip formatter={(x, n) => [inr(Number(x)), String(n)]} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart>
            </ResponsiveContainer></div>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Where each year's payments go</CardTitle></CardHeader><CardContent>
            <div className="h-64" role="img" aria-label="Yearly principal and interest paid"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={out.schedule} margin={{ left: 0, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} stroke="#e4e7ec" />
                <XAxis dataKey="year" tickFormatter={(y: number) => `Yr ${y}`} tick={axis} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(x: number) => inrShort(x)} tick={axis} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={(x, n) => [inr(Number(x)), String(n)]} labelFormatter={(y) => `Year ${y}`} cursor={{ fill: "#f4f5f7" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="principal" name="Principal" stackId="a" fill="#1f5fbf" />
                <Bar dataKey="interest" name="Interest" stackId="a" fill="#f2a900" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}

function AffordabilityCalculator() {
  const [v, setV] = useState({ monthly_income: 80_000, existing_emi: 10_000, rate: 9.5, years: 10 });
  const { out, error } = useLatest(v, (x) => api.affordability({ monthly_income: x.monthly_income, existing_emi: x.existing_emi, rate: x.rate, months: x.years * 12 }));
  const set = (k: keyof typeof v) => (n: number) => setV((p) => ({ ...p, [k]: n }));
  const pct = Math.min(100, (v.existing_emi / v.monthly_income) * 100);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
      <Card><CardContent className="space-y-6">
        <Slider label="Monthly income" value={v.monthly_income} min={10_000} max={500_000} step={5_000} display={inr(v.monthly_income)} onChange={set("monthly_income")} />
        <Slider label="Existing EMIs" value={v.existing_emi} min={0} max={Math.min(250_000, v.monthly_income)} step={500} display={inr(v.existing_emi)} onChange={set("existing_emi")} />
        <Slider label="Interest rate" value={v.rate} min={5} max={24} step={0.25} display={`${v.rate}% a year`} onChange={set("rate")} />
        <Slider label="Repayment period" value={v.years} min={1} max={30} step={1} display={`${v.years} years`} onChange={set("years")} />
      </CardContent></Card>
      {error ? <ErrorState message={error} /> : !out ? null : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {([["Comfortable", out.comfortable, "Keeps all EMIs under 35% of income", "text-good"], ["Stretch", out.stretch, "Up to 50% of income, with less room for surprises", "text-warn"]] as const).map(([name, t, note, c]) => (
              <Card key={name}><CardContent>
                <p className="text-sm text-muted">{name} borrowing limit</p>
                <p className={cn("font-display text-4xl font-semibold tabular-nums", c)}>{inr(t.max_loan)}</p>
                <p className="mt-2 text-sm">EMI budget <span className="font-semibold tabular-nums">{inr(t.emi_budget)}</span> a month</p>
                <p className="mt-1 text-xs text-muted">{note}</p>
              </CardContent></Card>
            ))}
          </div>
          <Card><CardContent>
            <h3 className="text-lg font-semibold">Your EMI load today: {out.current_obligation_pct}% of income</h3>
            <div className="relative mt-5 h-3 rounded-full bg-line" role="img" aria-label={`Existing EMIs use ${out.current_obligation_pct} percent of income`}>
              <div className={cn("h-full rounded-full", pct <= 35 ? "bg-good" : pct <= 50 ? "bg-warn" : "bg-bad")} style={{ width: `${pct}%` }} />
              {[35, 50].map((m) => <span key={m} className="absolute -top-1.5 h-6 w-0.5 bg-ink/40" style={{ left: `${m}%` }} />)}
            </div>
            <div className="relative mt-2 h-4 text-xs text-muted"><span className="absolute -translate-x-1/2" style={{ left: "35%" }}>35%</span><span className="absolute -translate-x-1/2" style={{ left: "50%" }}>50%</span></div>
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}

export default function CalculatorsPage() {
  const [tab, setTab] = useState<Tab>("emi");
  return (
    <>
      <PageHeader title="Calculators" subtitle="Work out your EMI or see how much you can afford before you apply." />
      <Tabs<Tab> className="mb-6" value={tab} onChange={setTab} items={[{ id: "emi", label: "EMI calculator" }, { id: "afford", label: "Affordability" }]} />
      {tab === "emi" ? <EmiCalculator /> : <AffordabilityCalculator />}
    </>
  );
}
