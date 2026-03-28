import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronDown, Download } from "lucide-react";
import type { AuditQuestion } from "@/hooks/useAudit";
import { confidenceToNumber } from "@/hooks/useAudit";

interface ScanScreenProps {
  questions: AuditQuestion[];
  error: string | null;
  onComplete: () => void;
}

type Filter = "all" | "met" | "not_met" | "partial" | "pending";

function StatusBadge({ status }: { status: AuditQuestion["status"] }) {
  if (status === null) {
    return (
      <span className="bg-surface-alt text-txt-3 animate-pulse text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0">
        scanning
      </span>
    );
  }

  const map = {
    met: { bg: "bg-ok-light", text: "text-ok", dot: "bg-ok", label: "Met" },
    not_met: { bg: "bg-ng-light", text: "text-ng", dot: "bg-ng", label: "Not Met" },
    partial: { bg: "bg-warn-light", text: "text-warn", dot: "bg-warn", label: "Partial" },
  };
  const s = map[status];

  return (
    <span
      className={`${s.bg} ${s.text} text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0`}
    >
      <span className={`w-[5px] h-[5px] rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default function ScanScreen({ questions, error, onComplete }: ScanScreenProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  const resolved = questions.filter((q) => q.status !== null).length;
  const total = questions.length;
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const allDone = total > 0 && resolved === total;

  const met = questions.filter((q) => q.status === "met").length;
  const notmet = questions.filter((q) => q.status === "not_met").length;
  const partial = questions.filter((q) => q.status === "partial").length;
  const pending = total - resolved;

  const currentQ = questions.find((q) => q.status === null);
  const currentIdx = currentQ ? currentQ.id : total;

  const [lastResult, setLastResult] = useState<AuditQuestion | null>(null);
  const prevResolved = useRef(resolved);

  useEffect(() => {
    if (resolved > prevResolved.current) {
      const justFinished = questions.filter((q) => q.status !== null).slice(-1)[0];
      if (justFinished) {
        setLastResult(justFinished);
        const timer = setTimeout(() => setLastResult(null), 2500);
        return () => clearTimeout(timer);
      }
    }
    prevResolved.current = resolved;
  }, [resolved, questions]);

  const tickerText = useMemo(() => {
    for (let i = questions.length - 1; i >= 0; i--) {
      if (questions[i].ticker) return questions[i].ticker;
    }
    return null;
  }, [questions]);

  const filtered = useMemo(() => {
    if (filter === "all") return questions;
    if (filter === "pending") return questions.filter((q) => q.status === null);
    return questions.filter((q) => q.status === filter);
  }, [questions, filter]);

  const filename = questions[0]?.filename || "audit.pdf";
  const now = new Date();
  const auditId = `AUDIT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  const dashoffset = 251.2 - (251.2 * pct) / 100;

  const exportCsv = () => {
    const header = "Question #,Question,Status,Evidence,Reason,Source,Confidence\n";
    const rows = questions
      .map(
        (q) =>
          `${q.id},"${(q.text || "").replace(/"/g, '""')}",${q.status || "pending"},"${(q.evidence || "").replace(/"/g, '""')}","${(q.reason || "").replace(/"/g, '""')}","${(q.source || "").replace(/"/g, '""')}",${q.confidence ?? ""}`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${auditId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const borderLeftColor = (status: AuditQuestion["status"]) => {
    if (status === "met") return "var(--color-ok)";
    if (status === "not_met") return "var(--color-ng)";
    if (status === "partial") return "var(--color-warn)";
    return "transparent";
  };

  return (
    <div className="max-w-[1180px] mx-auto px-6 py-8">
      {/* Mission bar */}
      <div className="flex justify-between items-center border-b border-border pb-5 mb-7">
        <span className="font-mono text-[11px] text-txt-3 tracking-widest">
          {auditId}
        </span>
        <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider">
          {allDone ? (
            <>
              <span className="w-[7px] h-[7px] rounded-full bg-ok" />
              <span className="text-ok font-medium">SCAN COMPLETE</span>
            </>
          ) : error ? (
            <>
              <span className="w-[7px] h-[7px] rounded-full bg-ng" />
              <span className="text-ng font-medium">CONNECTION LOST</span>
            </>
          ) : (
            <>
              <span className="w-[7px] h-[7px] rounded-full bg-primary animate-pulse" />
              <span className="text-primary font-medium">SCANNING</span>
            </>
          )}
        </div>
      </div>

      {/* Progress card */}
      <div className="grid grid-cols-[1fr_1fr] gap-4 mb-5">
        <div className="bg-surface border border-border rounded-xl p-6 flex items-center gap-6 shadow-sm">
          <div className="relative w-[88px] h-[88px] shrink-0">
            <svg viewBox="0 0 88 88" className="-rotate-90" width="88" height="88">
              <circle cx="44" cy="44" r="40" fill="none" stroke="#E2E8F0" strokeWidth="3" />
              <circle
                cx="44" cy="44" r="40" fill="none"
                stroke="#6366F1" strokeWidth="3" strokeLinecap="round"
                strokeDasharray="251.2" strokeDashoffset={dashoffset}
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-mono text-base font-semibold text-txt">
              {pct}%
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-txt truncate mb-0.5">{filename}</p>
            <p className="font-mono text-[11px] text-txt-3 tracking-wider mb-3.5">
              {total} requirements
            </p>
            <div className="h-[3px] bg-surface-alt rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="font-mono text-[11px] text-txt-3">
              {allDone
                ? "Analysis complete"
                : `Analyzing requirement ${currentIdx} of ${total}`}
            </p>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col">
          <p className="font-mono text-[10px] tracking-[0.08em] uppercase text-txt-3 font-semibold mb-3">
            {allDone ? "Last Analyzed" : "Currently Analyzing"}
          </p>
          {currentQ && !allDone ? (
            <div className="flex-1 flex flex-col">
              <span className="font-mono text-[11px] text-primary font-medium mb-1.5">
                Question {currentQ.id} of {total}
              </span>
              <p className="text-[13px] leading-relaxed text-txt flex-1">
                {currentQ.text}
              </p>
              {lastResult && (
                <div
                  key={lastResult.id}
                  className="mt-3 pt-3 border-t border-border flex items-center gap-2 animate-ticker-in"
                >
                  <StatusBadge status={lastResult.status} />
                  <span className="text-[11px] text-txt-3 truncate">
                    Q{lastResult.id}: {lastResult.text.slice(0, 60)}
                    {lastResult.text.length > 60 ? "..." : ""}
                  </span>
                </div>
              )}
            </div>
          ) : allDone ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <span className="w-[7px] h-[7px] rounded-full bg-ok inline-block mb-2" />
                <p className="text-[13px] text-txt-2">All requirements analyzed</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[12px] text-txt-3">Waiting for questions...</p>
            </div>
          )}
        </div>
      </div>

      {/* Live ticker */}
      {tickerText && !allDone && (
        <div className="flex items-center gap-2 h-6 overflow-hidden mb-6">
          <span className="font-mono text-[10px] text-primary uppercase tracking-wider shrink-0 font-medium">
            live
          </span>
          <span
            key={tickerText}
            className="font-mono text-[11px] text-txt-2 animate-ticker-in truncate"
          >
            {tickerText}
          </span>
        </div>
      )}
      {(!tickerText || allDone) && <div className="mb-6" />}

      {error && (
        <div className="bg-ng-light border border-ng/20 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
          <span className="w-[7px] h-[7px] rounded-full bg-ng mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-ng mb-0.5">Connection lost</p>
            <p className="text-[12px] text-txt-2 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {(
          [
            { label: "Met", count: met, color: "text-ok", bg: "bg-ok-light", borderC: "border-ok/20" },
            { label: "Not Met", count: notmet, color: "text-ng", bg: "bg-ng-light", borderC: "border-ng/20" },
            { label: "Partial", count: partial, color: "text-warn", bg: "bg-warn-light", borderC: "border-warn/20" },
            { label: "Pending", count: pending, color: "text-txt-3", bg: "bg-surface-alt", borderC: "border-border" },
          ] as const
        ).map((s) => (
          <div
            key={s.label}
            className={`bg-surface border rounded-xl p-3.5 shadow-sm ${
              s.count > 0 ? s.borderC : "border-border"
            }`}
          >
            <p className={`font-mono text-[26px] font-semibold leading-none mb-1 ${s.color}`}>
              {s.count}
            </p>
            <p className="font-mono text-[9px] tracking-widest text-txt-3 uppercase">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Filter strip */}
      <div className="flex items-center gap-1.5 mb-3">
        {(["all", "met", "not_met", "partial", "pending"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[12px] font-medium border rounded-full px-3.5 py-1 cursor-pointer transition ${
              filter === f
                ? "bg-primary text-white border-primary"
                : "border-border text-txt-3 hover:border-primary/30 hover:text-txt-2"
            }`}
          >
            {f === "all"
              ? "All"
              : f === "not_met"
                ? "Not Met"
                : f === "pending"
                  ? "Pending"
                  : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <button
          onClick={exportCsv}
          className="ml-auto text-[12px] font-medium border border-border text-txt-3 rounded-full px-3.5 py-1 cursor-pointer hover:text-primary hover:border-primary/30 transition flex items-center gap-1.5"
        >
          <Download className="w-3 h-3" /> Export
        </button>
      </div>

      {/* Question cards */}
      <div className="flex flex-col gap-2">
        {filtered.map((q) => {
          const isExpanded = expanded === q.id && q.status !== null;
          const confNum = confidenceToNumber(q.confidence);

          return (
            <div
              key={q.id}
              className="bg-surface border border-border rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-sm animate-q-in"
              style={{ borderLeftWidth: 3, borderLeftColor: borderLeftColor(q.status) }}
              onClick={() => setExpanded(expanded === q.id ? null : q.id)}
            >
              <div className="flex items-start gap-3 px-4 py-3.5">
                <span className="font-mono text-[11px] text-txt-3 min-w-[22px] pt-0.5 font-medium">
                  {q.id}
                </span>
                <span className="text-[13px] leading-relaxed text-txt flex-1">
                  {q.text}
                </span>
                <StatusBadge status={q.status} />
                <ChevronDown
                  className={`w-4 h-4 text-txt-3 shrink-0 mt-0.5 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>

              {isExpanded && (q.evidence || q.reason) && (
                <div className="border-t border-border pt-3.5 pr-4 pb-3.5 pl-[50px]">
                  {q.evidence && (
                    <>
                      <p className="text-[10px] tracking-[0.08em] uppercase text-txt-3 font-semibold mb-2">
                        Evidence
                      </p>
                      <p className="text-[13px] leading-[1.65] text-txt-2 border-l-2 border-primary/30 pl-3 mb-3">
                        {q.evidence}
                      </p>
                    </>
                  )}
                  {q.reason && (q.status === "not_met" || q.status === "partial") && (
                    <>
                      <p className="text-[10px] tracking-[0.08em] uppercase text-txt-3 font-semibold mb-2">
                        {q.status === "not_met" ? "Why Not Met" : "Why Partial"}
                      </p>
                      <p className="text-[13px] leading-[1.65] text-txt-2 border-l-2 border-ng/30 pl-3 mb-3">
                        {q.reason}
                      </p>
                    </>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    {q.source && (
                      <span className="font-mono text-[10px] bg-surface-alt border border-border rounded-md px-2 py-0.5 text-txt-2">
                        {q.source}
                      </span>
                    )}
                    {q.page && (
                      <span className="font-mono text-[10px] bg-surface-alt border border-border rounded-md px-2 py-0.5 text-txt-2">
                        {q.page}
                      </span>
                    )}
                    {q.confidence !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-txt-3 font-medium">
                          Confidence
                        </span>
                        <div className="w-16 h-[3px] bg-surface-alt rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-700"
                            style={{ width: `${confNum}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-txt-2 capitalize font-medium">
                          {q.confidence}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(allDone || (error && resolved > 0)) && (
        <div className="flex justify-center mt-8">
          <button
            onClick={onComplete}
            className="bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-7 py-3 cursor-pointer transition-colors shadow-sm flex items-center gap-2"
          >
            {allDone ? "View debrief" : "View partial debrief"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
