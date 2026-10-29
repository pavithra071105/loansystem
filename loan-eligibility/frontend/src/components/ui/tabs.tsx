import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem<T extends string> { id: T; label: string; icon?: ReactNode }

export function Tabs<T extends string>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}>
      {items.map((t) => (
        <button
          key={t.id} role="tab" type="button" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn("-mb-px flex cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
            value === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink")}
        >
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}
