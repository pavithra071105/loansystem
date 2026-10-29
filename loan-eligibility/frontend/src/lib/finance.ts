/** Mirrors backend/app/finance.py so the application form can preview an EMI instantly. */
export function emi(principal: number, annualRatePct: number, months: number): number {
  const r = annualRatePct / 1200;
  if (months <= 0) return 0;
  if (r === 0) return principal / months;
  const f = (1 + r) ** months;
  return (principal * r * f) / (f - 1);
}

export const effectiveRate = (base: number, creditScore: number) => +(base + Math.max(0, 750 - creditScore) * 0.015).toFixed(2);
