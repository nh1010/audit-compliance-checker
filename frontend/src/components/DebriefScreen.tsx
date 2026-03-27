import { useMemo } from "react";
import { AlertTriangle, Download, RotateCcw, CheckCircle, XCircle } from "lucide-react";
import type { AuditQuestion } from "@/hooks/useAudit";

interface DebriefScreenProps {
  questions: AuditQuestion[];
  onRestart: () => void;
}

export default function DebriefScreen({ questions, onRestart }: DebriefScreenProps) {
  const total = questions.length;
  const met = questions.filter((q) => q.status === "met").length;
  const notmet = questions.filter((q) => q.status === "not_met").length;
  const partial = questions.filter((q) => q.status === "partial").length;

  const score =
    total > 0 ? Math.round(((met + partial * 0.5) / total) * 100) : 0;
  const scoreColor =
    score >= 80 ? "text-ok" : score >= 50 ? "text-warn" : "text-ng";
  const scoreBg =
    score >= 80 ? "bg-ok-light" : score >= 50 ? "bg-warn-light" : "bg-ng-light";

  const date = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const actions = useMemo(
    () =>
      questions
        .filter((q) => q.remediation)
        .map((q) => ({ id: q.id, text: q.remediation! })),
    [questions],
  );

  const gaps = useMemo(
    () => questions.filter((q) => q.status === "not_met" || q.status === "partial"),
    [questions],
  );

  const exportCsv = () => {
    const header =
      "Question #,Question,Status,Evidence,Source,Page,Confidence,Remediation\n";
    const rows = questions
      .map(
        (q) =>
          `${q.id},"${(q.text || "").replace(/"/g, '""')}",${q.status || "pending"},"${(q.evidence || "").replace(/"/g, '""')}","${(q.source || "").replace(/"/g, '""')}","${(q.page || "").replace(/"/g, '""')}",${q.confidence ?? ""},"${(q.remediation || "").replace(/"/g, '""')}"`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-debrief-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[920px] mx-auto px-6 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-border pb-6 mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-txt tracking-tight">
            Audit Complete
          </h1>
          <p className="text-sm text-txt-3 mt-1">
            {date} — {total} requirements analyzed
          </p>
        </div>
        <div className={`text-right ${scoreBg} rounded-xl px-5 py-3`}>
          <p className={`font-mono text-[36px] font-bold leading-none ${scoreColor}`}>
            {score}
          </p>
          <p className="text-[10px] text-txt-3 uppercase tracking-widest font-semibold mt-1">
            Compliance Score
          </p>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {(
          [
            { label: "Met", count: met, color: "text-ok", icon: CheckCircle, bg: "bg-ok-light", borderC: "border-ok/20" },
            { label: "Not Met", count: notmet, color: "text-ng", icon: XCircle, bg: "bg-ng-light", borderC: "border-ng/20" },
            { label: "Partial", count: partial, color: "text-warn", icon: AlertTriangle, bg: "bg-warn-light", borderC: "border-warn/20" },
            { label: "Total", count: total, color: "text-txt", icon: null, bg: "bg-surface-alt", borderC: "border-border" },
          ] as const
        ).map((s) => (
          <div
            key={s.label}
            className={`bg-surface border ${s.borderC} rounded-xl p-4 shadow-sm`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className={`font-mono text-[28px] font-bold leading-none ${s.color}`}>
                {s.count}
              </p>
              {s.icon && <s.icon className={`w-5 h-5 ${s.color} opacity-50`} />}
            </div>
            <p className="text-[10px] tracking-widest text-txt-3 uppercase font-semibold mb-2">
              {s.label}
            </p>
            <div className="h-[3px] bg-surface-alt rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  s.label === "Met" ? "bg-ok" : s.label === "Not Met" ? "bg-ng" : s.label === "Partial" ? "bg-warn" : "bg-txt-3"
                }`}
                style={{
                  width: total > 0 ? `${(s.count / total) * 100}%` : "0%",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Action card */}
      {actions.length > 0 && (
        <div className="bg-warn-light border border-warn/20 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-warn/10 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-warn" />
            </div>
            <span className="text-sm font-semibold text-warn">
              Priority Remediation Actions
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {actions.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5">
                <span className="text-[12px] text-warn font-bold mt-px">
                  {a.id}.
                </span>
                <span className="text-[13px] text-txt-2 leading-snug">
                  {a.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gaps section */}
      {gaps.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[11px] tracking-widest uppercase text-txt-3 font-semibold shrink-0">
              Gaps Requiring Action
            </span>
            <span className="flex-1 h-px bg-border" />
          </div>
          <div className="flex flex-col gap-2">
            {gaps.map((q) => (
              <div
                key={q.id}
                className="flex items-start gap-3 bg-surface border border-border rounded-xl p-4 shadow-sm"
              >
                <span className="font-mono text-[11px] text-txt-3 min-w-[22px] pt-0.5 font-medium">
                  {q.id}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] leading-relaxed text-txt">
                    {q.text.length > 120 ? q.text.slice(0, 120) + "..." : q.text}
                  </p>
                  {q.evidence && (
                    <p className="text-[12px] text-txt-3 mt-1.5 leading-snug">
                      {q.evidence}
                    </p>
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 ${
                    q.status === "not_met"
                      ? "bg-ng-light text-ng"
                      : "bg-warn-light text-warn"
                  }`}
                >
                  {q.status === "not_met" ? "Not Met" : "Partial"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex gap-3">
        <button
          onClick={exportCsv}
          className="bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-5 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2 shadow-sm"
        >
          <Download className="w-4 h-4" /> Export Report
        </button>
        <button
          onClick={onRestart}
          className="border border-border text-txt-2 font-medium rounded-xl px-5 py-2.5 text-sm hover:border-primary/30 hover:text-primary transition-all cursor-pointer flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" /> New Audit
        </button>
      </div>
    </div>
  );
}
