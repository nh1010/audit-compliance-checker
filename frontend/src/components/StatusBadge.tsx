import { Check, X, AlertTriangle, Clock } from "lucide-react";

const config = {
  met: { icon: Check, label: "Met", bg: "bg-met-bg", text: "text-met", border: "border-met/20" },
  not_met: { icon: X, label: "Not Met", bg: "bg-not-met-bg", text: "text-not-met", border: "border-not-met/20" },
  partial: { icon: AlertTriangle, label: "Partial", bg: "bg-partial-bg", text: "text-partial", border: "border-partial/20" },
  pending: { icon: Clock, label: "Pending", bg: "bg-pending-bg", text: "text-pending", border: "border-pending/20" },
} as const;

export default function StatusBadge({ status }: { status: "met" | "not_met" | "partial" | "pending" }) {
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}
