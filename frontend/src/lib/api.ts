import type { UploadResponse, ParsedQuestion, AnalysisResult } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function parseAudit(fileId: string): Promise<ParsedQuestion[]> {
  const res = await fetch(`${API_URL}/api/audit/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.questions;
}

export async function analyzeCompliance(
  questions: ParsedQuestion[],
  onResult: (result: AnalysisResult) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  const res = await fetch(`${API_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions }),
  });

  if (!res.ok) {
    onError(await res.text());
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) { onError("No response body"); return; }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data: ")) {
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") {
          onDone();
          return;
        }
        try {
          onResult(JSON.parse(payload));
        } catch {
          // skip malformed lines
        }
      }
    }
  }
  onDone();
}
