import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileText,
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Clock,
} from "lucide-react";
import ReadilyLogo from "./ReadilyLogo";

interface UploadScreenProps {
  onFileSelect: (file: File, domains: string[]) => void;
  onDemo: () => void;
  error?: string | null;
}

export default function UploadScreen({ onFileSelect, onDemo, error }: UploadScreenProps) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (file.type === "application/pdf") {
      setSelectedFile(file);
    }
  }, []);

  const handleStart = useCallback(() => {
    if (selectedFile) {
      onFileSelect(selectedFile, []);
    }
  }, [onFileSelect, selectedFile]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setDragging(false), []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[48%] bg-[#0F1629] text-white flex-col justify-center items-center p-10 xl:p-14 relative overflow-hidden">

        <div className="relative z-10 text-center max-w-md">
          <ReadilyLogo className="mb-8 justify-center text-white" />

          <h1 className="text-[44px] xl:text-[50px] font-bold tracking-tight leading-[1.08] mb-4">
            Audit prep,
            <br />
            <span className="text-[#818CF8]">
              done in minutes.
            </span>
          </h1>

          <p className="text-[15px] text-white/55 leading-relaxed mb-8">
            Upload your questionnaire and Readily checks every requirement
            against your P&Ps — surfacing gaps, evidence, and action items
            automatically.
          </p>

          {/* Feature list */}
          <div className="flex flex-col gap-6">
            {[
              {
                icon: CheckCircle2,
                title: "Instant gap detection",
                desc: "Finds missing requirements across hundreds of pages in seconds.",
              },
              {
                icon: FileSearch,
                title: "Evidence with every finding",
                desc: "Every result links to the exact policy section — no guesswork.",
              },
              {
                icon: Clock,
                title: "Results stream in real time",
                desc: "Watch the analysis happen live as each requirement resolves.",
              },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <f.icon className="w-5 h-5 text-[#818CF8]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">{f.title}</p>
                  <p className="text-[13px] text-white/40 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-16 xl:px-20 py-12">
        <div className="max-w-lg mx-auto w-full">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-primary font-semibold mb-2">
            Compliance Audit System
          </p>
          <h2 className="text-[28px] font-bold text-txt tracking-tight mb-2">
            Run your audit
          </h2>
          <p className="text-sm text-txt-3 mb-8 leading-relaxed">
            Upload a P&P questionnaire PDF and get a full compliance report.
          </p>

          {error && (
            <div className="bg-ng-light border border-ng/20 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
              <span className="w-[7px] h-[7px] rounded-full bg-ng mt-1.5 shrink-0" />
              <p className="text-[13px] text-ng leading-relaxed">
                {error}
              </p>
            </div>
          )}

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all group mb-5 ${
              dragging
                ? "border-primary bg-primary-light scale-[1.01]"
                : selectedFile
                  ? "border-primary/30 bg-primary-light/40"
                  : "border-border-strong hover:border-primary/40 hover:bg-primary-light/30"
            }`}
            onClick={() => inputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            {selectedFile ? (
              <>
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-semibold text-txt mb-0.5">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-txt-3">
                  {(selectedFile.size / 1024).toFixed(0)} KB — click to change
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl bg-surface-alt border border-border flex items-center justify-center mx-auto mb-3 group-hover:border-primary/30 transition-colors">
                  <Upload className="w-5 h-5 text-txt-3 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm font-semibold text-txt mb-1">
                  Drop your audit PDF here
                </p>
                <p className="text-xs text-txt-3">
                  or{" "}
                  <span className="text-primary font-medium">click to browse</span>{" "}
                  — PDF only, up to 50MB
                </p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={onInputChange}
            />
          </div>

          {/* Start button */}
          {selectedFile && (
            <button
              onClick={handleStart}
              className="w-full mb-5 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-6 py-3.5 text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              Start Analysis
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
