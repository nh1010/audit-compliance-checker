import { useState, useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import type { ParseStep } from "@/hooks/useAudit";

interface ParsingScreenProps {
  filename: string;
  step: ParseStep;
}

const STEPS: { key: ParseStep; label: string; detail: string }[] = [
  {
    key: "uploading",
    label: "Uploading document",
    detail: "Sending your PDF to the server for processing",
  },
  {
    key: "extracting",
    label: "Extracting requirements",
    detail:
      "Analyzing document structure and pulling out every auditable requirement — this may take a few minutes for longer documents",
  },
];

export default function ParsingScreen({ filename, step }: ParsingScreenProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [step]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr =
    minutes > 0
      ? `${minutes}m ${String(seconds).padStart(2, "0")}s`
      : `${seconds}s`;

  const currentIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="max-w-[560px] mx-auto px-6 py-20 animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl p-8 shadow-sm">
        {/* File info */}
        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-primary-light border border-primary/20 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-txt truncate">
              {filename}
            </p>
            <p className="font-mono text-[11px] text-txt-3 tracking-wider">
              Processing document
            </p>
          </div>
          <span className="font-mono text-[11px] text-txt-3 tabular-nums shrink-0">
            {timeStr}
          </span>
        </div>

        {/* Step indicators */}
        <div className="flex flex-col gap-5">
          {STEPS.map((s, idx) => {
            const isActive = idx === currentIdx;
            const isDone = idx < currentIdx;

            return (
              <div key={s.key} className="flex items-start gap-3.5">
                {/* Step icon */}
                <div className="pt-0.5 shrink-0">
                  {isDone ? (
                    <div className="w-6 h-6 rounded-full bg-ok flex items-center justify-center">
                      <svg
                        className="w-3.5 h-3.5 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  ) : isActive ? (
                    <div className="w-6 h-6 rounded-full bg-primary-light border border-primary/30 flex items-center justify-center">
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-surface-alt border border-border" />
                  )}
                </div>

                {/* Step text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[13px] font-semibold mb-0.5 ${
                      isActive
                        ? "text-txt"
                        : isDone
                          ? "text-ok"
                          : "text-txt-3"
                    }`}
                  >
                    {s.label}
                  </p>
                  {(isActive || isDone) && (
                    <p className="text-[12px] text-txt-3 leading-relaxed">
                      {s.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pulsing bar at bottom */}
        <div className="mt-8 h-[3px] bg-surface-alt rounded-full overflow-hidden">
          <div className="h-full w-full bg-primary/30 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
