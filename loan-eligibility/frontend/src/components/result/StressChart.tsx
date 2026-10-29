import { Bar, BarChart, Cell, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, toneFor } from "@/components/ui/badge";
import { TONE, inr } from "@/lib/utils";
import type { StressRow } from "@/lib/types";

const SHORT: Record<string, string> = { income_10: "Income -10%", income_25: "Income -25%", rate_2: "Rates +2", emi_25: "EMIs +25%", credit_60: "Credit -60", combined: "Combined" };
const VERDICT_LABEL = { approved: "Holds up", review: "Weakens", unlikely: "At risk" } as const;

export function StressChart({ rows, baseline }: { rows: StressRow[]; baseline: number }) {
  const data = [{ id: "base", label: "Today", short: "Today", probability: baseline, verdict: baseline >= 70 ? "approved" : baseline >= 45 ? "review" : "unlikely" } as const, ...rows.map((r) => ({ ...r, short: SHORT[r.id] ?? r.label }))];
  return (
    <div className="space-y-6">
      <div className="h-72" role="img" aria-label="Approval chance under each stress scenario">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e4e7ec" />
            <XAxis dataKey="short" tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} interval={0} />
            <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} />
            <ReferenceLine y={70} stroke="#12805c" strokeDasharray="4 4" />
            <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, "Approval chance"]} labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} cursor={{ fill: "#f4f5f7" }} />
            <Bar dataKey="probability" radius={[4, 4, 0, 0]}>
              {data.map((d) => <Cell key={d.id} fill={TONE[d.verdict].hex} />)}
              <LabelList dataKey="probability" position="top" formatter={(v) => `${Number(v).toFixed(0)}%`} style={{ fontSize: 12, fontWeight: 600, fill: "#101828" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-muted"><tr><th className="py-2 font-medium">Scenario</th><th className="font-medium">Approval chance</th><th className="font-medium">Change</th><th className="font-medium">EMI</th><th className="font-medium">Debt-to-income</th><th className="font-medium">Outcome</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-2.5 font-semibold">{r.label}</td>
                <td className="tabular-nums">{r.probability.toFixed(0)}%</td>
                <td className={`tabular-nums ${r.change < -0.5 ? "text-bad" : "text-muted"}`}>{r.change > 0 ? "+" : ""}{r.change.toFixed(1)}</td>
                <td className="tabular-nums">{inr(r.emi)}</td>
                <td className="tabular-nums">{r.dti.toFixed(0)}%</td>
                <td><Badge tone={toneFor(r.verdict)}>{VERDICT_LABEL[r.verdict]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
