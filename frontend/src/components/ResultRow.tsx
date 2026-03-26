import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Shield } from "lucide-react";
import type { ParsedQuestion, AnalysisResult } from "@/lib/types";
import StatusBadge from "./StatusBadge";

interface Props {
  question: ParsedQuestion;
  result?: AnalysisResult;
}

export default function ResultRow({ question, result }: Props) {
  const [open, setOpen] = useState(false);
  const status = result?.status ?? "pending";

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-shadow hover:shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left cursor-pointer"
      >
        <span className="text-sm font-bold text-slate-400 w-8 shrink-0">
          {question.number}
        </span>
        <p className="text-sm text-slate-700 flex-1 line-clamp-2">{question.text}</p>
        <StatusBadge status={status} />
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-100">
          <div className="pt-4 space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Full Question</p>
              <p className="text-sm text-slate-700">{question.text}</p>
              {question.reference && (
                <p className="text-xs text-slate-400 mt-1">{question.reference}</p>
              )}
            </div>

            {result ? (
              <>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Evidence
                  </p>
                  <blockquote className="text-sm text-slate-700 bg-slate-50 border-l-3 border-primary pl-3 py-2 pr-3 rounded-r-lg italic">
                    "{result.evidence}"
                  </blockquote>
                </div>
                <div className="flex gap-6 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Source: {result.policy_source}
                  </span>
                  {result.page && <span>Page: {result.page}</span>}
                  <span>Confidence: {result.confidence}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400 italic">Analysis pending...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
