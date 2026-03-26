import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowLeft, Download, Filter } from "lucide-react";
import type { ParsedQuestion, PolicyMetadata, AnalysisResult } from "@/lib/types";
import { analyzeCompliance } from "@/lib/api";
import SummaryCards from "@/components/SummaryCards";
import ProgressBar from "@/components/ProgressBar";
import ResultRow from "@/components/ResultRow";

interface Props {
  questions: ParsedQuestion[];
  policies: PolicyMetadata[];
}

type StatusFilter = "all" | "met" | "not_met" | "partial" | "pending";

export default function Results({ questions, policies }: Props) {
  const navigate = useNavigate();
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState("");
  const started = useRef(false);

  const runAnalysis = useCallback(() => {
    if (questions.length === 0 || policies.length === 0) return;
    setAnalyzing(true);
    setError("");
    analyzeCompliance(
      questions,
      policies.map(p => p.file_id),
      (result) => setResults(prev => [...prev, result]),
      () => setAnalyzing(false),
      (err) => { setError(err); setAnalyzing(false); },
    );
  }, [questions, policies]);

  useEffect(() => {
    if (!started.current && questions.length > 0) {
      started.current = true;
      runAnalysis();
    }
  }, [runAnalysis, questions.length]);

  const resultMap = new Map(results.map(r => [r.question_number, r]));

  const filteredQuestions = questions.filter(q => {
    if (filter === "all") return true;
    const r = resultMap.get(q.number);
    if (filter === "pending") return !r;
    return r?.status === filter;
  });

  function exportCSV() {
    const header = "Question #,Question,Status,Evidence,Policy Source,Page,Confidence\n";
    const rows = questions.map(q => {
      const r = resultMap.get(q.number);
      return [
        q.number,
        `"${q.text.replace(/"/g, '""')}"`,
        r?.status ?? "pending",
        `"${(r?.evidence ?? "").replace(/"/g, '""')}"`,
        r?.policy_source ?? "",
        r?.page ?? "",
        r?.confidence ?? "",
      ].join(",");
    });
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compliance-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">No audit questions loaded.</p>
          <button onClick={() => navigate("/")} className="text-primary font-medium hover:underline">
            Go back and upload files
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-primary" />
          <h1 className="text-lg font-bold text-slate-800">Audit Compliance Checker</h1>
          <div className="flex-1" />
          <button onClick={() => navigate("/")} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" /> New Audit
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-6">
        <SummaryCards results={results} total={questions.length} />

        {analyzing && <ProgressBar completed={results.length} total={questions.length} />}

        {error && (
          <div className="p-4 bg-not-met-bg border border-not-met/20 rounded-xl text-sm text-not-met">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            {(["all", "met", "not_met", "partial", "pending"] as StatusFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === f ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f === "all" ? "All" : f === "not_met" ? "Not Met" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={exportCSV}
            disabled={results.length === 0}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline disabled:text-slate-300 disabled:no-underline"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        <div className="space-y-3">
          {filteredQuestions.map(q => (
            <ResultRow key={q.number} question={q} result={resultMap.get(q.number)} />
          ))}
        </div>
      </main>
    </div>
  );
}
