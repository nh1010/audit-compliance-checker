import type { AnalysisResult } from "@/lib/types";
import { CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";

interface Props {
  results: AnalysisResult[];
  total: number;
}

export default function SummaryCards({ results, total }: Props) {
  const met = results.filter(r => r.status === "met").length;
  const notMet = results.filter(r => r.status === "not_met").length;
  const partial = results.filter(r => r.status === "partial").length;
  const pending = total - results.length;

  const cards = [
    { label: "Met", count: met, icon: CheckCircle2, color: "text-met", bg: "bg-met-bg", border: "border-met/20" },
    { label: "Not Met", count: notMet, icon: XCircle, color: "text-not-met", bg: "bg-not-met-bg", border: "border-not-met/20" },
    { label: "Partial", count: partial, icon: AlertTriangle, color: "text-partial", bg: "bg-partial-bg", border: "border-partial/20" },
    { label: "Pending", count: pending, icon: Clock, color: "text-pending", bg: "bg-pending-bg", border: "border-pending/20" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className={`flex items-center gap-3 p-4 rounded-xl border ${c.bg} ${c.border}`}>
          <c.icon className={`w-8 h-8 ${c.color}`} />
          <div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.count}</div>
            <div className="text-xs text-slate-500">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
