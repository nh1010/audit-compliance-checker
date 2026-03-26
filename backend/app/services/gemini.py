import json
import os
import logging
from typing import AsyncGenerator

from google import genai
from google.genai import types

from app.models.schemas import ParsedQuestion, AnalysisResult

logger = logging.getLogger(__name__)

BATCH_SIZE = 5

SYSTEM_PROMPT = """You are a healthcare compliance auditor. You are given:
1. A set of audit questions about whether an organization's Policies & Procedures (P&P) meet specific regulatory requirements.
2. The full text of one or more P&P documents.

For each audit question, determine whether the requirement is met by the provided policies.

Respond with a JSON array. Each element must have exactly these fields:
- "question_number": the question number (integer)
- "status": one of "met", "not_met", or "partial"
- "evidence": the exact quote from the policy that addresses the requirement (empty string if not_met)
- "policy_source": the policy document ID where the evidence was found (e.g. "GG.1508") (empty string if not_met)
- "page": the approximate page reference if identifiable (e.g. "Page 10 of 25"), otherwise empty string
- "confidence": one of "high", "medium", or "low"

Rules:
- "met" means the policy clearly and fully addresses every element of the requirement.
- "partial" means the policy addresses some but not all elements, or the language is ambiguous.
- "not_met" means no relevant language was found in any provided policy.
- For the evidence field, quote the actual policy text verbatim. Keep it concise (1-3 sentences).
- Be precise and conservative. If unsure, use "partial" with "medium" or "low" confidence.
- Return ONLY the JSON array, no other text."""


def _get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    return genai.Client(api_key=api_key)


def _build_prompt(questions: list[ParsedQuestion], policy_texts: dict[str, str]) -> str:
    parts = []

    parts.append("=== POLICY DOCUMENTS ===\n")
    for pid, text in policy_texts.items():
        parts.append(f"--- Policy: {pid} ---\n{text}\n")

    parts.append("\n=== AUDIT QUESTIONS ===\n")
    for q in questions:
        parts.append(f"{q.number}. {q.text}")
        if q.reference:
            parts.append(f"   ({q.reference})")
        parts.append("")

    return "\n".join(parts)


def _parse_response(text: str, expected_numbers: list[int]) -> list[AnalysisResult]:
    """Parse the Gemini response JSON, handling common formatting issues."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse Gemini response as JSON: %s", cleaned[:200])
        return [
            AnalysisResult(
                question_number=n,
                status="not_met",
                evidence="Error: could not parse AI response",
                policy_source="",
                page="",
                confidence="low",
            )
            for n in expected_numbers
        ]

    results = []
    seen = set()
    for item in data:
        try:
            r = AnalysisResult(
                question_number=int(item.get("question_number", 0)),
                status=item.get("status", "not_met"),
                evidence=item.get("evidence", ""),
                policy_source=item.get("policy_source", ""),
                page=item.get("page", ""),
                confidence=item.get("confidence", "low"),
            )
            if r.status not in ("met", "not_met", "partial"):
                r.status = "not_met"
            if r.confidence not in ("high", "medium", "low"):
                r.confidence = "low"
            seen.add(r.question_number)
            results.append(r)
        except Exception:
            continue

    for n in expected_numbers:
        if n not in seen:
            results.append(AnalysisResult(
                question_number=n,
                status="not_met",
                evidence="Error: no response from AI for this question",
                policy_source="",
                page="",
                confidence="low",
            ))

    return sorted(results, key=lambda r: r.question_number)


async def analyze_batch(
    questions: list[ParsedQuestion],
    policy_texts: dict[str, str],
) -> list[AnalysisResult]:
    """Analyze a batch of questions against the policy texts."""
    client = _get_client()

    prompt = _build_prompt(questions, policy_texts)
    expected = [q.number for q in questions]

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.1,
        ),
    )
    return _parse_response(response.text, expected)


async def analyze_all(
    questions: list[ParsedQuestion],
    policy_texts: dict[str, str],
) -> AsyncGenerator[AnalysisResult, None]:
    """Analyze all questions in batches, yielding results as they complete."""
    for i in range(0, len(questions), BATCH_SIZE):
        batch = questions[i : i + BATCH_SIZE]
        results = await analyze_batch(batch, policy_texts)
        for r in results:
            yield r
