import { Input, Label, Select } from "@/components/ui/input";
import type { Field } from "@/lib/types";
import { cn, inrShort } from "@/lib/utils";

interface Props { field: Field; value: string; error?: string; onChange: (v: string) => void; className?: string }

/** Renders one field of the server-defined schema (number or select). */
export function DynamicField({ field, value, error, onChange, className }: Props) {
  const id = `f-${field.name}`;
  const n = Number(value);
  const rupee = field.unit === "₹";
  return (
    <div className={className}>
      <Label htmlFor={id}>{field.label}</Label>
      {field.type === "select" ? (
        <Select id={id} value={value} invalid={!!error} onChange={(e) => onChange(e.target.value)}>
          {field.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      ) : (
        <div className="relative">
          {rupee && <span aria-hidden className="pointer-events-none absolute left-3 top-2.5 text-sm text-muted">₹</span>}
          <Input id={id} type="number" inputMode="decimal" min={field.min} max={field.max} step={field.step} value={value} invalid={!!error}
            onChange={(e) => onChange(e.target.value)} className={cn(rupee && "pl-7", field.unit && !rupee && "pr-12")} />
          {field.unit && !rupee && <span aria-hidden className="pointer-events-none absolute right-3 top-2.5 text-sm text-muted">{field.unit}</span>}
        </div>
      )}
      {error ? <p className="mt-1 text-xs text-bad">{error}</p>
        : <p className="mt-1 min-h-4 text-xs text-muted">{rupee && value !== "" && Number.isFinite(n) && n > 0 ? `${inrShort(n)}${field.help ? `. ${field.help}` : ""}` : field.help}</p>}
    </div>
  );
}
