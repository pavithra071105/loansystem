import { animate } from "framer-motion";
import { useEffect, useState } from "react";
import { TONE, cn, type ToneKey } from "@/lib/utils";

const CX = 130, CY = 130, R = 104;
const pt = (v: number, r = R) => {
  const a = Math.PI - (v / 100) * Math.PI;
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)] as const;
};
const arc = (from: number, to: number) => {
  const [x1, y1] = pt(from), [x2, y2] = pt(to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

/** The one animated moment: the needle sweeps to the applicant's approval probability. */
export function ProbabilityGauge({ value, tone, label, className }: { value: number; tone: ToneKey; label?: string; className?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const controls = animate(0, value, { duration: calm ? 0 : 1.3, ease: [0.22, 1, 0.36, 1], onUpdate: setShown });
    return () => controls.stop();
  }, [value]);

  const [nx, ny] = pt(shown, R - 20);
  return (
    <figure className={cn("w-full max-w-[320px]", className)} aria-label={`Approval probability ${value.toFixed(0)} percent`}>
      <svg viewBox="0 0 260 154" className="w-full" role="img">
        <path d={arc(0.6, 44.4)} stroke="#f3c6cf" strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d={arc(45.6, 69.4)} stroke="#f6dca6" strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d={arc(70.6, 99.4)} stroke="#a9dcc8" strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d={arc(0.6, Math.max(shown, 0.7))} stroke={TONE[tone].hex} strokeWidth="16" fill="none" strokeLinecap="round" opacity={0.95} />
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="#F2A900" strokeWidth="4" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="9" fill="#0B2545" />
        <circle cx={CX} cy={CY} r="3.5" fill="#ffffff" />
        <text x="14" y="150" fontSize="11" fill="#667085">0</text>
        <text x="236" y="150" fontSize="11" fill="#667085" textAnchor="end">100</text>
      </svg>
      <figcaption className="mt-0.5 text-center">
        <span className="font-display text-6xl font-semibold tabular-nums" style={{ color: TONE[tone].hex }}>{Math.round(shown)}</span>
        <span className="font-display text-2xl text-muted">%</span>
        {label && <p className="mt-1 text-sm text-muted">{label}</p>}
      </figcaption>
    </figure>
  );
}
