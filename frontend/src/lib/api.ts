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

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function streamSSE(
  questions: ParsedQuestion[],
  onResult: (result: AnalysisResult) => void,
): Promise<"done" | "dropped"> {
  const res = await fetch(`${API_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
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
          if (payload === "[DONE]") return "done";
          try {
            onResult(JSON.parse(payload));
          } catch {
            // skip malformed lines
          }
        }
      }
    }
  } catch {
    return "dropped";
  }

  return "done";
}

export async function analyzeCompliance(
  questions: ParsedQuestion[],
  onResult: (result: AnalysisResult) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  const answered = new Set<number>();

  const trackingOnResult = (result: AnalysisResult) => {
    answered.add(result.question_number);
    onResult(result);
  };

  let remaining = questions;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const outcome = await streamSSE(remaining, trackingOnResult);

    if (outcome === "done") {
      onDone();
      return;
    }

    remaining = questions.filter((q) => !answered.has(q.number));
    if (remaining.length === 0) {
      onDone();
      return;
    }

    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * (attempt + 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  onError(
    `Connection lost after ${MAX_RETRIES} retries. ${answered.size}/${questions.length} questions analyzed.`,
  );
}
