import type { UploadResponse, ParsedQuestion, ParseEvent, AnalysisResult } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const PARSE_TIMEOUT_MS = 10 * 60 * 1000;

export async function parseAuditStream(
  fileId: string,
  onEvent: (event: ParseEvent) => void,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PARSE_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}/api/audit/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(await res.text());

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

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
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.type === "error") {
            throw new Error(parsed.message || "Extraction failed");
          }
          onEvent(parsed as ParseEvent);
        } catch (e) {
          if (e instanceof Error && e.message !== "Extraction failed") continue;
          throw e;
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Requirement extraction timed out. The document may be too large.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

type StreamOutcome = { status: "done" } | { status: "dropped" } | { status: "error"; message: string };

async function streamSSE(
  questions: ParsedQuestion[],
  onResult: (result: AnalysisResult) => void,
): Promise<StreamOutcome> {
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
          if (payload === "[DONE]") return { status: "done" };
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) return { status: "error", message: parsed.error };
            if (parsed.question_number != null) onResult(parsed);
          } catch {
            // skip malformed lines
          }
        }
      }
    }
  } catch {
    return { status: "dropped" };
  }

  return { status: "done" };
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

    if (outcome.status === "done") {
      onDone();
      return;
    }

    if (outcome.status === "error") {
      onError(outcome.message);
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
