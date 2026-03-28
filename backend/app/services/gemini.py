import asyncio
import json
import os
import logging
from typing import AsyncGenerator, Callable

from google import genai
from google.genai import types

from app.models.schemas import ParsedQuestion, AnalysisResult

logger = logging.getLogger(__name__)

BATCH_SIZE = 1

SYSTEM_PROMPT = """You are a healthcare compliance auditor. You are given:
1. A set of audit questions about whether an organization's Policies & Procedures (P&P) meet specific regulatory requirements.
2. Relevant excerpts retrieved from P&P documents (each labelled with its policy ID and page).

For each audit question, determine whether the requirement is met by the provided policy excerpts.

Respond with a JSON array. Each element must have exactly these fields:
- "question_number": the question number (integer)
- "status": one of "met", "not_met", or "partial"
- "evidence": the exact quote from the policy that addresses the requirement (empty string if not_met)
- "policy_source": the policy document ID where the evidence was found (e.g. "GG.1508") (empty string if not_met)
- "page": the page reference from the excerpt metadata (e.g. "Page 10"), otherwise empty string
- "confidence": one of "high", "medium", or "low"
- "reason": a brief explanation of why the requirement is not met or only partially met (1-2 sentences). For "met" status, use an empty string.

Rules:
- "met" means the policy clearly and fully addresses every element of the requirement.
- "partial" means the policy addresses some but not all elements, or the language is ambiguous.
- "not_met" means no relevant language was found in any provided excerpt.
- For the evidence field, quote the actual policy text verbatim. Keep it concise (1-3 sentences).
- For the reason field on "not_met": explain what specific policy language or section is missing. For "partial": explain which elements are addressed and which are missing or unclear.
- Be precise and conservative. If unsure, use "partial" with "medium" or "low" confidence.
- Return ONLY the JSON array, no other text."""


def _get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    return genai.Client(api_key=api_key)


def _build_prompt(
    questions: list[ParsedQuestion],
    chunks: list[dict],
) -> str:
    parts = []

    parts.append("=== RELEVANT POLICY EXCERPTS ===\n")
    for i, chunk in enumerate(chunks, 1):
        pid = chunk.get("policy_id", "unknown")
        page = chunk.get("page", "")
        title = chunk.get("title", "")
        header = f"--- Excerpt {i} | Policy: {pid}"
        if title:
            header += f" | {title}"
        if page:
            header += f" | {page}"
        header += " ---"
        parts.append(f"{header}\n{chunk['text']}\n")

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
                reason="AI response could not be parsed",
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
                reason=item.get("reason", ""),
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
                reason="No response received from AI for this question",
            ))

    return sorted(results, key=lambda r: r.question_number)


def _analyze_batch_sync(
    questions: list[ParsedQuestion],
    search_fn: Callable[[str], list[dict]],
) -> list[AnalysisResult]:
    """Synchronous core — runs in a thread pool to avoid blocking the event loop."""
    client = _get_client()

    all_chunks: list[dict] = []
    seen_texts: set[str] = set()
    for q in questions:
        query = f"{q.text} {q.reference}".strip()
        results = search_fn(query)
        for chunk in results:
            if chunk["text"] not in seen_texts:
                seen_texts.add(chunk["text"])
                all_chunks.append(chunk)

    prompt = _build_prompt(questions, all_chunks)
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
    search_fn: Callable[[str], list[dict]],
) -> AsyncGenerator[AnalysisResult, None]:
    """Analyze all questions, yielding each result as it completes."""
    loop = asyncio.get_event_loop()
    for i in range(0, len(questions), BATCH_SIZE):
        batch = questions[i : i + BATCH_SIZE]
        results = await loop.run_in_executor(
            None, _analyze_batch_sync, batch, search_fn
        )
        for r in results:
            yield r
