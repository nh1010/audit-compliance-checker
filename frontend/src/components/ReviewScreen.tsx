import { useState, useMemo } from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Layers,
  Loader2,
} from "lucide-react";
import type { ParsedQuestion } from "@/lib/types";

interface ReviewScreenProps {
  questions: ParsedQuestion[];
  sectionNames: string[];
  extractingSection: string | null;
  extractionDone: boolean;
  filename: string;
  onStartAnalysis: (ignoredIds: Set<number>) => void;
  onBack: () => void;
}

type SectionStatus = "done" | "extracting" | "pending";

export default function ReviewScreen({
  questions,
  sectionNames,
  extractingSection,
  extractionDone,
  filename,
  onStartAnalysis,
  onBack,
}: ReviewScreenProps) {
  const [ignoredIds, setIgnoredIds] = useState<Set<number>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );

  const questionsBySection = useMemo(() => {
    const map = new Map<string, ParsedQuestion[]>();
    for (const q of questions) {
      const key = q.section || "All Requirements";
      const list = map.get(key);
      if (list) {
        list.push(q);
      } else {
        map.set(key, [q]);
      }
    }
    return map;
  }, [questions]);

  const completedSectionCount = sectionNames.filter(
    (name) => (questionsBySection.get(name)?.length ?? 0) > 0 || false,
  ).length;

  const activeCount = questions.length - ignoredIds.size;

  const getSectionStatus = (name: string): SectionStatus => {
    if (extractingSection === name) return "extracting";
    if (questionsBySection.has(name)) return "done";
    return "pending";
  };

  const toggleIgnore = (id: number) => {
    setIgnoredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const toggleIgnoreAll = (sectionName: string) => {
    const sectionQs = questionsBySection.get(sectionName) || [];
    const allIgnored = sectionQs.every((q) => ignoredIds.has(q.number));
    setIgnoredIds((prev) => {
      const next = new Set(prev);
      for (const q of sectionQs) {
        if (allIgnored) next.delete(q.number);
        else next.add(q.number);
      }
      return next;
    });
  };

  return (
    <div className="max-w-[1180px] mx-auto px-6 pt-8 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-5 mb-7">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary-light border border-primary/20 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-txt truncate">
              {filename}
            </p>
            <p className="font-mono text-[11px] text-txt-3 tracking-wider">
              {extractionDone
                ? `${questions.length} requirements extracted`
                : `Extracting — ${completedSectionCount}/${sectionNames.length} sections`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {ignoredIds.size > 0 && (
            <span className="font-mono text-[11px] text-txt-3 bg-surface-alt border border-border rounded-full px-3 py-1">
              {ignoredIds.size} ignored
            </span>
          )}
          {questions.length > 0 && (
            <span className="font-mono text-[11px] text-primary font-medium bg-primary-light border border-primary/20 rounded-full px-3 py-1">
              {activeCount} to analyze
            </span>
          )}
        </div>
      </div>

      {/* Extraction progress bar */}
      {!extractionDone && (
        <div className="mb-6">
          <div className="h-[3px] bg-surface-alt rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{
                width: `${sectionNames.length > 0 ? (completedSectionCount / sectionNames.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {extractionDone && (
        <p className="text-[13px] text-txt-2 mb-6 leading-relaxed">
          Review the extracted requirements before starting the compliance scan.
          Toggle the eye icon to ignore requirements you don't need analyzed.
        </p>
      )}

      {/* Section groups */}
      <div className="flex flex-col gap-3">
        {sectionNames.map((sectionName) => {
          const status = getSectionStatus(sectionName);
          const sectionQs = questionsBySection.get(sectionName) || [];
          const isCollapsed = collapsedSections.has(sectionName);
          const sectionIgnoredCount = sectionQs.filter((q) =>
            ignoredIds.has(q.number),
          ).length;
          const allIgnored =
            sectionQs.length > 0 &&
            sectionIgnoredCount === sectionQs.length;

          return (
            <div
              key={sectionName}
              className={`bg-surface border rounded-xl overflow-hidden shadow-sm transition-all ${
                status === "pending"
                  ? "border-border/40 opacity-50"
                  : status === "extracting"
                    ? "border-primary/30"
                    : allIgnored
                      ? "border-border/60 opacity-60"
                      : "border-border"
              }`}
            >
              {/* Section header */}
              <div
                className={`flex items-center gap-3 px-4 py-3 select-none transition-colors ${
                  status === "done"
                    ? "cursor-pointer hover:bg-surface-alt/50"
                    : ""
                }`}
                onClick={() => status === "done" && toggleSection(sectionName)}
              >
                {/* Status indicator */}
                {status === "extracting" ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                ) : status === "done" ? (
                  <ChevronDown
                    className={`w-4 h-4 text-txt-3 shrink-0 transition-transform ${
                      isCollapsed ? "-rotate-90" : ""
                    }`}
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-border shrink-0" />
                )}

                <span
                  className={`text-[13px] font-semibold flex-1 ${
                    status === "pending"
                      ? "text-txt-3"
                      : status === "extracting"
                        ? "text-primary"
                        : allIgnored
                          ? "text-txt-3 line-through"
                          : "text-txt"
                  }`}
                >
                  {sectionName}
                </span>

                {status === "extracting" && (
                  <span className="font-mono text-[10px] text-primary animate-pulse">
                    Extracting...
                  </span>
                )}

                {status === "done" && (
                  <>
                    <span className="font-mono text-[10px] text-txt-3 bg-surface-alt border border-border rounded-md px-2 py-0.5">
                      {sectionQs.length - sectionIgnoredCount}/
                      {sectionQs.length}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleIgnoreAll(sectionName);
                      }}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                        allIgnored
                          ? "border-primary/20 text-primary bg-primary-light hover:bg-primary/10"
                          : "border-border text-txt-3 hover:text-ng hover:border-ng/30"
                      }`}
                      title={
                        allIgnored
                          ? "Include all"
                          : "Ignore all in this section"
                      }
                    >
                      {allIgnored ? "Include all" : "Ignore all"}
                    </button>
                  </>
                )}
              </div>

              {/* Requirement rows (only for done sections) */}
              {status === "done" && !isCollapsed && sectionQs.length > 0 && (
                <div className="border-t border-border">
                  {sectionQs.map((q, idx) => {
                    const isIgnored = ignoredIds.has(q.number);
                    return (
                      <div
                        key={q.number}
                        className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                          idx < sectionQs.length - 1
                            ? "border-b border-border/50"
                            : ""
                        } ${isIgnored ? "opacity-50" : "hover:bg-surface-alt/30"}`}
                      >
                        <span className="font-mono text-[11px] text-txt-3 min-w-[28px] pt-0.5 font-medium text-right shrink-0">
                          {q.number}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[13px] leading-relaxed ${
                              isIgnored
                                ? "text-txt-3 line-through"
                                : "text-txt"
                            }`}
                          >
                            {q.text}
                          </p>
                          {q.reference && (
                            <span className="inline-block mt-1.5 font-mono text-[10px] text-txt-3 bg-surface-alt border border-border rounded-md px-2 py-0.5">
                              {q.reference}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => toggleIgnore(q.number)}
                          className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                            isIgnored
                              ? "bg-ng-light text-ng border border-ng/20 hover:bg-ng/10"
                              : "bg-surface-alt text-txt-3 border border-border hover:text-primary hover:border-primary/30"
                          }`}
                          title={
                            isIgnored
                              ? "Include requirement"
                              : "Ignore requirement"
                          }
                        >
                          {isIgnored ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface/90 backdrop-blur-lg border-t border-border">
        <div className="max-w-[1180px] mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-[13px] font-medium text-txt-3 hover:text-txt transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <div className="flex items-center gap-4">
            {ignoredIds.size > 0 && extractionDone && (
              <button
                onClick={() => setIgnoredIds(new Set())}
                className="text-[12px] font-medium text-txt-3 hover:text-primary transition-colors cursor-pointer"
              >
                Clear all ignored
              </button>
            )}
            <button
              onClick={() => onStartAnalysis(ignoredIds)}
              disabled={!extractionDone || activeCount === 0}
              className="bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-6 py-2.5 text-[13px] transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
            >
              {extractionDone ? (
                <>
                  Analyze {activeCount} requirement
                  {activeCount !== 1 ? "s" : ""}
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Extracting... ({completedSectionCount}/{sectionNames.length}{" "}
                  sections)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
