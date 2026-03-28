import { useState, useRef, useCallback } from "react";
import { uploadFile, parseAudit, analyzeCompliance } from "@/lib/api";
import type { ParsedQuestion, AnalysisResult } from "@/lib/types";

export interface AuditQuestion {
  id: number;
  text: string;
  reference: string;
  status: null | "met" | "not_met" | "partial";
  evidence: string | null;
  source: string | null;
  page: string | null;
  confidence: "high" | "medium" | "low" | null;
  ticker: string | null;
  remediation: string | null;
  reason: string | null;
  domain: string;
  filename: string;
}

export type Screen = "upload" | "scanning" | "debrief";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const confidenceToNumber = (c: "high" | "medium" | "low" | null): number => {
  if (c === "high") return 95;
  if (c === "medium") return 65;
  if (c === "low") return 30;
  return 0;
};

const DEMO_QUESTIONS = [
  {
    text: "Does the P&P state that under existing Contract requirements and state law, MCPs are required to provide hospice services upon Member election?",
    status: "partial" as const,
    evidence:
      "Section 4.2 addresses member election but omits statutory language required by state law.",
    source: "P&P Doc §4.2, §7.1",
    page: "Page 12",
    confidence: "medium" as const,
    ticker: "Cross-referencing §4.2 with statutory hospice requirements...",
    remediation:
      "Strengthen MCP obligation language in §4.2 to explicitly cite state law and Contract requirements.",
    reason:
      "§4.2 covers member election but does not reference specific state law or Contract requirements mandating hospice service provision.",
  },
  {
    text: "Does the P&P state that Members who qualify for and elect to receive hospice care services remain enrolled in an MCP while receiving such services?",
    status: "met" as const,
    evidence:
      "Section 3.1 explicitly states members electing hospice care shall maintain MCP enrollment throughout the duration of hospice services.",
    source: "P&P Doc §3.1",
    page: "Page 8",
    confidence: "high" as const,
    ticker:
      "Match found in §3.1 — enrollment continuity clause confirmed...",
    remediation: null,
    reason: null,
  },
  {
    text: "Does the P&P state that MCPs should clarify how Members may access hospice care services in a timely manner, preferably within 24 hours of the request?",
    status: "not_met" as const,
    evidence:
      "No timeliness language exists anywhere in the document. §5.3 covers general specialist referrals only.",
    source: "§5.3 (gap identified)",
    page: "",
    confidence: "high" as const,
    ticker:
      "Scanning all referral provisions — no 24-hour hospice clause found...",
    remediation:
      "Add 24-hour access language for hospice referrals in §5.3.",
    reason:
      "No policy section addresses timely access to hospice services or a 24-hour response requirement. §5.3 covers specialist referrals but not hospice-specific timelines.",
  },
  {
    text: "Does the P&P state MCPs may restrict coverage to in-Network Providers, unless Medically Necessary services are not available in-Network?",
    status: "partial" as const,
    evidence:
      "In-network restriction language present in §6.1 but the medical necessity exception doesn't explicitly reference Medi-Cal contractual requirements.",
    source: "P&P Doc §6.1",
    page: "Page 19",
    confidence: "medium" as const,
    ticker:
      "Medi-Cal exception language present but incomplete in §6.1...",
    remediation:
      "Update §6.1 to explicitly reference Medi-Cal contractual requirements.",
    reason:
      "§6.1 addresses in-network restrictions but the medical necessity exception lacks an explicit reference to Medi-Cal contractual requirements.",
  },
  {
    text: "Does the P&P state Members who elect hospice care are entitled to curative treatment for conditions unrelated to their terminal illness?",
    status: "met" as const,
    evidence:
      "Section 8.4 clearly states members retain full entitlement to curative treatments for diagnoses unrelated to their terminal condition.",
    source: "P&P Doc §8.4",
    page: "Page 24",
    confidence: "high" as const,
    ticker: "Concurrent care entitlement confirmed in §8.4...",
    remediation: null,
    reason: null,
  },
  {
    text: "Does the P&P state that for out-of-Network hospice Providers, the MCP should seek a single case agreement or letter of agreement?",
    status: "not_met" as const,
    evidence:
      "OON provider agreements not addressed in the hospice section. §9.2 covers specialists only.",
    source: "§9.2 (gap identified)",
    page: "",
    confidence: "high" as const,
    ticker:
      "OON hospice provisions absent — §9.2 covers specialists only...",
    remediation:
      "Insert out-of-network hospice provider agreement provisions — entirely absent from current P&P.",
    reason:
      "No policy section addresses out-of-network hospice provider agreements. §9.2 only covers specialist OON agreements.",
  },
  {
    text: "Does the P&P state that while Prior Authorization for hospice services is restricted, MCPs are required to review documentation to avoid Fraud, Waste, and Abuse?",
    status: "partial" as const,
    evidence:
      "PA restrictions acknowledged in §11.1, but FWA review requirements are only in general Addendum B rather than inline.",
    source: "P&P Doc §11.1, Addendum B",
    page: "Page 31",
    confidence: "medium" as const,
    ticker:
      "FWA language found in Addendum B — not integrated in §11.1...",
    remediation:
      "Integrate FWA documentation requirements directly into §11.1.",
    reason:
      "FWA review requirements exist in Addendum B but are not integrated into the hospice-specific §11.1 section, making the connection indirect.",
  },
];

function tickerForQuestion(q: ParsedQuestion): string {
  return `Retrieving policy context for Q${q.number}...`;
}

function remediationFromResult(
  result: AnalysisResult,
  questionText: string,
): string | null {
  if (result.status === "met") return null;
  if (result.status === "not_met")
    return `Address gap: ${questionText.slice(0, 120)}`;
  return `Strengthen policy language: ${questionText.slice(0, 120)}`;
}

export function useAudit() {
  const [screen, setScreen] = useState<Screen>("upload");
  const [questions, setQuestions] = useState<AuditQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runDemo = useCallback(async () => {
    abortRef.current = false;
    const initial: AuditQuestion[] = DEMO_QUESTIONS.map((q, i) => ({
      id: i + 1,
      text: q.text,
      reference: "",
      status: null,
      evidence: null,
      source: null,
      page: null,
      confidence: null,
      ticker: null,
      remediation: null,
      reason: null,
      domain: "Hospice Services",
      filename: "demo-audit.pdf",
    }));
    setQuestions(initial);
    setScreen("scanning");

    for (let i = 0; i < DEMO_QUESTIONS.length; i++) {
      if (abortRef.current) return;
      const d = DEMO_QUESTIONS[i];
      const qId = i + 1;

      setQuestions((prev) =>
        prev.map((q) => (q.id === qId ? { ...q, ticker: d.ticker } : q)),
      );

      await sleep(900 + Math.random() * 1100);
      if (abortRef.current) return;

      setQuestions((prev) =>
        prev.map((q) =>
          q.id === qId
            ? {
                ...q,
                status: d.status,
                evidence: d.evidence,
                source: d.source,
                page: d.page,
                confidence: d.confidence,
                remediation: d.remediation,
                reason: d.reason ?? null,
              }
            : q,
        ),
      );
    }
  }, []);

  const runReal = useCallback(async (file: File, domains: string[]) => {
    abortRef.current = false;
    setError(null);
    setScreen("scanning");

    try {
      const { file_id, filename } = await uploadFile(file);

      const parsed: ParsedQuestion[] = await parseAudit(file_id);

      const initial: AuditQuestion[] = parsed.map((pq) => ({
        id: pq.number,
        text: pq.text,
        reference: pq.reference,
        status: null,
        evidence: null,
        source: null,
        page: null,
        confidence: null,
        ticker: null,
        remediation: null,
        reason: null,
        domain: domains[0] || "",
        filename,
      }));
      setQuestions(initial);

      // Show tickers as analysis starts
      let tickerIdx = 0;
      tickerRef.current = setInterval(() => {
        if (tickerIdx < parsed.length) {
          const pq = parsed[tickerIdx];
          setQuestions((prev) =>
            prev.map((q) =>
              q.id === pq.number
                ? { ...q, ticker: tickerForQuestion(pq) }
                : q,
            ),
          );
          tickerIdx++;
        }
      }, 800);

      await analyzeCompliance(
        parsed,
        (result: AnalysisResult) => {
          if (abortRef.current) return;
          setQuestions((prev) =>
            prev.map((q) =>
              q.id === result.question_number
                ? {
                    ...q,
                    status: result.status,
                    evidence: result.evidence,
                    source: result.policy_source,
                    page: result.page,
                    confidence: result.confidence,
                    ticker:
                      q.ticker ||
                      `Analyzed: ${q.text.slice(0, 60)}...`,
                    remediation: remediationFromResult(result, q.text),
                    reason: result.reason || null,
                  }
                : q,
            ),
          );
        },
        () => {
          if (tickerRef.current) clearInterval(tickerRef.current);
          tickerRef.current = null;
        },
        (err: string) => {
          if (tickerRef.current) clearInterval(tickerRef.current);
          tickerRef.current = null;
          setError(err);
        },
      );
    } catch (err) {
      if (tickerRef.current) clearInterval(tickerRef.current);
      tickerRef.current = null;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setScreen("upload");
    }
  }, []);

  const goDebrief = useCallback(() => setScreen("debrief"), []);

  const restart = useCallback(() => {
    abortRef.current = true;
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
    setScreen("upload");
    setQuestions([]);
    setError(null);
  }, []);

  return { screen, questions, error, runDemo, runReal, goDebrief, restart };
}
