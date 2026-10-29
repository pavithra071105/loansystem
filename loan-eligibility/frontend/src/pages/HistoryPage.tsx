import { Download, FilePlus2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, ErrorState, PageHeader, PageLoader } from "@/components/Feedback";
import { Badge, toneFor } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { LOAN_LABELS } from "@/lib/loanIcons";
import { dateLabel, inr, months } from "@/lib/utils";

const VERDICT = { approved: "Likely approved", review: "Needs review", unlikely: "Unlikely" } as const;

export default function HistoryPage() {
  const [filter, setFilter] = useState("");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const navigate = useNavigate();
  const { data, error, loading, reload } = useAsync(() => api.history(filter || undefined), [filter]);

  const del = async (id: number) => {
    try { await api.remove(id); setConfirm(null); setNote("Application deleted."); reload(); } catch { setNote("Couldn't delete that application. Try again."); }
  };
  const pdf = async (id: number) => { try { await api.downloadReport(id); } catch { setNote("The PDF couldn't be created. Try again."); } };

  return (
    <>
      <PageHeader title="History" subtitle="Every eligibility check you've run. Open one to revisit the explanation or download the report."
        actions={<><Select aria-label="Filter by loan type" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-48">
          <option value="">All loan types</option>{Object.entries(LOAN_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          <Link to="/apply" className={buttonVariants()}><FilePlus2 className="size-4" />New application</Link></>} />
      {note && <p role="status" className="mb-4 rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary">{note}</p>}
      {loading ? <PageLoader /> : error || !data ? <ErrorState message={error ?? "Couldn't load your history."} onRetry={reload} />
        : !data.predictions.length ? <EmptyState title={filter ? "Nothing for this loan type" : "No applications yet"} body="Checks you run will show up here." />
        : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-line text-left text-muted">
                <tr><th className="px-5 py-3 font-medium">Date</th><th className="font-medium">Loan</th><th className="font-medium">Amount</th><th className="font-medium">Approval chance</th><th className="font-medium">Outcome</th><th className="px-5 text-right font-medium">Actions</th></tr>
              </thead>
              <tbody>
                {data.predictions.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/results/${r.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-5 py-3.5 text-muted">{dateLabel(r.created_at)}</td>
                    <td className="font-semibold">{LOAN_LABELS[r.loan_type]}</td>
                    <td className="tabular-nums">{inr(r.loan_amount)}<span className="block text-xs text-muted">{months(r.tenure_months)}</span></td>
                    <td><div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded-full bg-line"><div className="h-full rounded-full bg-primary" style={{ width: `${r.probability}%` }} /></div><span className="w-9 font-semibold tabular-nums">{r.probability.toFixed(0)}%</span></div></td>
                    <td><Badge tone={toneFor(r.verdict)}>{VERDICT[r.verdict]}</Badge></td>
                    <td className="px-5 text-right" onClick={(e) => e.stopPropagation()}>
                      {confirm === r.id ? (
                        <span className="inline-flex items-center gap-1"><Button size="sm" variant="danger" onClick={() => del(r.id)}>Delete</Button><Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Keep</Button></span>
                      ) : (
                        <span className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" aria-label={`Download report ${r.id}`} onClick={() => pdf(r.id)}><Download className="size-4" /></Button>
                          <Button size="sm" variant="ghost" aria-label={`Delete application ${r.id}`} onClick={() => setConfirm(r.id)}><Trash2 className="size-4" /></Button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
    </>
  );
}
