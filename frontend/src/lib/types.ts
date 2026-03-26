export interface ParsedQuestion {
  number: number;
  text: string;
  reference: string;
}

export interface PolicyMetadata {
  file_id: string;
  filename: string;
  policy_id: string;
  title: string;
}

export interface AnalysisResult {
  question_number: number;
  status: "met" | "not_met" | "partial";
  evidence: string;
  policy_source: string;
  page: string;
  confidence: "high" | "medium" | "low";
}

export interface UploadResponse {
  file_id: string;
  filename: string;
  metadata: {
    policy_id: string;
    title: string;
  };
}
