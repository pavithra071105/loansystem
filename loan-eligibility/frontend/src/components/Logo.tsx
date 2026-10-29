import { cn } from "@/lib/utils";

export function Logo({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill={dark ? "#ffffff" : "#0B2545"} />
        <path d="M7 21a9 9 0 0 1 18 0" fill="none" stroke="#F2A900" strokeWidth="3" strokeLinecap="round" />
        <circle cx="16" cy="21" r="2.4" fill={dark ? "#0B2545" : "#ffffff"} />
      </svg>
      <span className={cn("font-display text-xl font-semibold tracking-tight", dark ? "text-white" : "text-ink")}>LoanLens</span>
    </div>
  );
}
