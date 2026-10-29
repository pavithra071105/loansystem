import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Spinner = ({ className }: { className?: string }) => <Loader2 aria-label="Loading" className={cn("size-5 animate-spin text-primary", className)} />;

export const PageLoader = ({ label = "Loading" }: { label?: string }) => (
  <div role="status" className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-muted"><Spinner className="size-7" />{label}</div>
);

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card role="alert" className="flex flex-col items-center gap-3 p-10 text-center">
      <AlertCircle className="size-8 text-bad" />
      <p className="max-w-md text-sm text-muted">{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </Card>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mb-3 max-w-sm text-sm text-muted">{body}</p>
      {action}
    </Card>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 max-w-xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: string; tone?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={cn("mt-1 font-display text-3xl font-semibold tabular-nums", tone)}>{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </Card>
  );
}
