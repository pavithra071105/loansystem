import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const inr = (n: number) => `₹${inrFmt.format(Math.round(n))}`;
export const num = (n: number) => inrFmt.format(Math.round(n));

/** Compact Indian units: 1,50,000 -> ₹1.5 L, 2,00,00,000 -> ₹2 Cr */
export function inrShort(n: number): string {
  const abs = Math.abs(n);
  const trim = (v: number) => String(+v.toFixed(2));
  if (abs >= 1e7) return `₹${trim(n / 1e7)} Cr`;
  if (abs >= 1e5) return `₹${trim(n / 1e5)} L`;
  if (abs >= 1e3) return `₹${trim(n / 1e3)}k`;
  return `₹${Math.round(n)}`;
}

export const months = (m: number) => (m % 12 === 0 && m >= 24 ? `${m / 12} years` : `${m} months`);

export const dateLabel = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  new Date(iso).toLocaleDateString("en-IN", opts);

export const TONE = {
  approved: { text: "text-good", bg: "bg-good-soft", hex: "#12805c" },
  review: { text: "text-warn", bg: "bg-warn-soft", hex: "#b76e00" },
  unlikely: { text: "text-bad", bg: "bg-bad-soft", hex: "#c2344d" },
  low: { text: "text-good", bg: "bg-good-soft", hex: "#12805c" },
  moderate: { text: "text-warn", bg: "bg-warn-soft", hex: "#b76e00" },
  high: { text: "text-bad", bg: "bg-bad-soft", hex: "#c2344d" },
} as const;
export type ToneKey = keyof typeof TONE;
