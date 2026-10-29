import { cn } from "@/lib/utils";

interface Props {
  label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void; hint?: string; className?: string;
}

export function Slider({ label, value, min, max, step, display, onChange, hint, className }: Props) {
  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label className="text-sm font-semibold">{label}</label>
        <span className="text-sm font-semibold tabular-nums text-primary">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn("h-2 w-full cursor-pointer appearance-none rounded-full bg-line")}
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
