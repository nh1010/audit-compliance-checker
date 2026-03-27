import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import { uploadFile, parseAudit } from "@/lib/api";
import type { ParsedQuestion } from "@/lib/types";

interface Props {
  onReady: (questions: ParsedQuestion[]) => void;
}

export default function Home({ onReady }: Props) {
  const navigate = useNavigate();
  const [auditFiles, setAuditFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canStart = auditFiles.length === 1;

  async function handleStart() {
    if (!canStart) return;
    setLoading(true);
    setError("");

    try {
      const auditUpload = await uploadFile(auditFiles[0]);
      const questions = await parseAudit(auditUpload.file_id);

      onReady(questions);
      navigate("/results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-primary" />
          <h1 className="text-lg font-bold text-text">Audit Compliance Checker</h1>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-text mb-2">
            Check Policy Compliance
          </h2>
          <p className="text-text-muted max-w-xl mx-auto">
            Upload your audit questionnaire and we'll check it against the indexed
            policy documents to surface evidence and compliance status.
          </p>
        </div>

        <div className="max-w-md mx-auto mb-8">
          <FileUpload
            label="Audit Questions"
            description="Single PDF with audit questionnaire"
            files={auditFiles}
            onFiles={setAuditFiles}
            loading={loading}
          />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-not-met-bg border border-not-met/20 rounded-xl text-sm text-not-met">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={handleStart}
            disabled={!canStart || loading}
            className={`
              inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all
              ${canStart && !loading
                ? "bg-primary text-white hover:bg-primary-dark cursor-pointer shadow-md hover:shadow-lg"
                : "bg-surface text-text-faint cursor-not-allowed"}
            `}
          >
            {loading ? "Uploading..." : "Start Analysis"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
