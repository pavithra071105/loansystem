import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { api } from "@/lib/api";
import { useLatest } from "@/lib/hooks";
import type { LoanType, Prediction } from "@/lib/types";
import { TONE, cn, inr, inrShort, months } from "@/lib/utils";

export function WhatIf({ prediction, loan }: { prediction: Prediction; loan: LoanType }) {
  const input = prediction.input as Record<string, number>;
  const field = (n: string) => loan.fields.find((f) => f.name === n)!;
  const base = useMemo(() => ({ credit_score: input.credit_score, monthly_income: input.monthly_income, existing_emi: input.existing_emi, loan_amount: input.loan_amount, tenure_months: input.tenure_months }), [input]);
  const [v, setV] = useState(base);
  const changes = useMemo(() => Object.fromEntries(Object.entries(v).filter(([k, x]) => x !== base[k as keyof typeof base])), [v, base]);
  const changed = Object.keys(changes).length > 0;
  const { out, error } = useLatest(changes, (c) => api.whatIf(prediction.id, c), 200);

  const assetCap = loan.asset_field && "down_payment" in input ? input[loan.asset_field] - input.down_payment : Infinity;
  const amountMax = Math.min(field("loan_amount").max!, assetCap);
  const set = (k: keyof typeof base) => (x: number) => setV((p) => ({ ...p, [k]: x }));
  const scenario = changed ? out?.scenario : out?.baseline;
  const shown = scenario ?? out?.baseline;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div><h3 className="text-lg font-semibold">What if your numbers changed?</h3><p className="text-sm text-muted">Move a slider to see the effect on your chances. Nothing here is saved.</p></div>
            <Button variant="ghost" size="sm" onClick={() => setV(base)} disabled={!changed}><RotateCcw className="size-4" />Reset</Button>
          </div>
          <Slider label="Credit score" value={v.credit_score} min={300} max={900} step={5} display={String(v.credit_score)} onChange={set("credit_score")} />
          <Slider label="Monthly income" value={v.monthly_income} min={field("monthly_income").min!} max={Math.max(field("monthly_income").max! / 5, base.monthly_income * 2)} step={1000} display={inr(v.monthly_income)} onChange={set("monthly_income")} />
          <Slider label="Existing EMIs" value={v.existing_emi} min={0} max={Math.max(base.monthly_income, base.existing_emi)} step={500} display={inr(v.existing_emi)} onChange={set("existing_emi")} />
          <Slider label="Loan amount" value={Math.min(v.loan_amount, amountMax)} min={loan.min_amount} max={amountMax} step={field("loan_amount").step!} display={inrShort(v.loan_amount)} onChange={set("loan_amount")} />
          <div>
            <label htmlFor="wi-tenure" className="mb-1.5 block text-sm font-semibold">Repayment period</label>
            <Select id="wi-tenure" value={v.tenure_months} onChange={(e) => set("tenure_months")(Number(e.target.value))}>
              {loan.tenures.map((t) => <option key={t} value={t}>{months(t)}</option>)}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit lg:sticky lg:top-8">
        <CardContent>
          {error ? <p role="alert" className="text-sm text-bad">{error}</p> : !shown ? <p className="text-sm text-muted">Calculating</p> : (
            <>
              <p className="text-sm text-muted">{changed ? "Approval chance with your changes" : "Your current approval chance"}</p>
              <p className="mt-1 font-display text-6xl font-semibold tabular-nums" style={{ color: TONE[shown.verdict.code].hex }}>{shown.probability.toFixed(0)}<span className="text-2xl text-muted">%</span></p>
              {changed && out && (
                <p className={cn("mt-1 flex items-center gap-1 text-sm font-semibold", out.change >= 0 ? "text-good" : "text-bad")}>
                  {out.change >= 0 ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}{Math.abs(out.change).toFixed(1)} points vs. today ({out.baseline.probability.toFixed(0)}%)
                </p>
              )}
              <p className="mt-3 text-sm font-semibold" style={{ color: TONE[shown.verdict.code].hex }}>{shown.verdict.label}. {shown.risk.label}.</p>
              <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                {[["Monthly EMI", inr(shown.emi)], ["Interest rate", `${shown.interest_rate}% a year`], ["Debt-to-income", `${shown.dti.toFixed(0)}%`]].map(([k, x]) => (
                  <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="font-semibold tabular-nums">{x}</dd></div>
                ))}
              </dl>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
