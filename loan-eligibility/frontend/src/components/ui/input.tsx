import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const base = "h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-muted/70 transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 disabled:opacity-60";
const tone = (invalid?: boolean) => (invalid ? "border-bad focus-visible:outline-bad" : "border-line hover:border-[#c5cad3] focus-visible:outline-primary");

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> { invalid?: boolean }
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, invalid, ...p }, ref) => (
  <input ref={ref} aria-invalid={invalid || undefined} className={cn(base, tone(invalid), className)} {...p} />
));
Input.displayName = "Input";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { invalid?: boolean }
export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, invalid, children, ...p }, ref) => (
  <div className="relative">
    <select ref={ref} aria-invalid={invalid || undefined} className={cn(base, tone(invalid), "cursor-pointer appearance-none pr-9", className)} {...p}>{children}</select>
    <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-3 size-4 text-muted" />
  </div>
));
Select.displayName = "Select";

export const Label = ({ className, ...p }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("mb-1.5 block text-sm font-semibold text-ink", className)} {...p} />
);
