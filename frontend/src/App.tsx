import { useAudit } from "@/hooks/useAudit";
import UploadScreen from "@/components/UploadScreen";
import ScanScreen from "@/components/ScanScreen";
import DebriefScreen from "@/components/DebriefScreen";
import ReadilyLogo from "@/components/ReadilyLogo";

export default function App() {
  const { screen, questions, error, runDemo, runReal, goDebrief, restart } = useAudit();

  return (
    <div className="min-h-screen bg-bg">
      {screen !== "upload" && (
        <nav className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur-lg">
          <div className="max-w-[1180px] mx-auto px-6 py-3.5 flex items-center justify-between">
            <ReadilyLogo />
            <button
              onClick={restart}
              className="text-xs font-medium text-txt-3 hover:text-primary transition-colors cursor-pointer"
            >
              New audit
            </button>
          </div>
        </nav>
      )}

      {screen === "upload" && (
        <UploadScreen onFileSelect={runReal} onDemo={runDemo} />
      )}
      {screen === "scanning" && (
        <ScanScreen questions={questions} error={error} onComplete={goDebrief} />
      )}
      {screen === "debrief" && (
        <DebriefScreen questions={questions} onRestart={restart} />
      )}
    </div>
  );
}
