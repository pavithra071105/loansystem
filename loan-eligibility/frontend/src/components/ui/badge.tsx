import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    tone: {
      neutral: "bg-paper text-muted", primary: "bg-primary-soft text-primary",
      good: "bg-good-soft text-good", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export const Badge = ({ className, tone, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) => (
  <span className={cn(badge({ tone }), className)} {...p} />
);

export const toneFor = (key: string): "good" | "warn" | "bad" =>
  key === "approved" || key === "low" ? "good" : key === "review" || key === "moderate" ? "warn" : "bad";
