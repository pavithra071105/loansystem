import { Bar, BarChart, Cell, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Factor } from "@/lib/types";

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Factor }[] }) {
  if (!active || !payload?.length) return null;
  const f = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-md">
      <p className="font-semibold">{f.label}</p>
      <p className="text-muted">Your value: {f.value}</p>
      <p className={f.impact >= 0 ? "font-semibold text-good" : "font-semibold text-bad"}>{f.impact >= 0 ? "Raises" : "Lowers"} your chance by {Math.abs(f.impact).toFixed(1)} points</p>
    </div>
  );
}

export function FactorChart({ factors }: { factors: Factor[] }) {
  const max = Math.max(5, ...factors.map((f) => Math.abs(f.impact)));
  const bound = Math.ceil(max / 4) * 4;
  return (
    <div style={{ height: factors.length * 44 + 40 }} role="img" aria-label="Bar chart of how each factor changes your approval chance">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={factors} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#e4e7ec" />
          <XAxis type="number" domain={[-bound, bound]} ticks={[-bound, -bound / 2, 0, bound / 2, bound]} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}`} tick={{ fontSize: 12, fill: "#667085" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 13, fill: "#101828" }} axisLine={false} tickLine={false} />
          <ReferenceLine x={0} stroke="#98a2b3" />
          <Tooltip content={<Tip />} cursor={{ fill: "#f4f5f7" }} />
          <Bar dataKey="impact" radius={4} barSize={20}>
            {factors.map((f) => <Cell key={f.feature} fill={f.impact >= 0 ? "#12805c" : "#c2344d"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
