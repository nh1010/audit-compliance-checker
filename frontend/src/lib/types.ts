export interface ParsedQuestion {
  number: number;
  text: string;
  reference: string;
  section?: string;
  source_doc?: string;
}

export interface AnalysisResult {
  question_number: number;
  status: "met" | "not_met" | "partial";
  evidence: string;
  policy_source: string;
  page: string;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface UploadResponse {
  file_id: string;
  filename: string;
}

export type ParseEvent =
  | { type: "toc"; sections: string[] }
  | { type: "extracting"; section: string }
  | { type: "section"; section: string; questions: ParsedQuestion[] }
  | { type: "error"; message: string };
