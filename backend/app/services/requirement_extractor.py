import json
import logging
import os
import re
import time
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Generator, Literal

from google import genai
from google.genai import types
from httpx import TransportError

from app.models.schemas import ParsedQuestion
from app.services.pdf_parser import extract_text_with_pages

logger = logging.getLogger(__name__)

MAX_PAGES_PER_CHUNK = 20
PAGE_OVERLAP = 3
MAX_RETRIES = 5

TOC_SYSTEM_PROMPT = """You are a document structure analyst. Given the opening pages of a regulatory or policy document, extract the table of contents as structured JSON.

Return a JSON array where each element has:
- "title": the section title (string)
- "start_page": the page number where the section begins (integer)
- "end_page": the page number where the section ends (integer, use the start_page of the next section minus 1)

If there is an explicit table of contents, use it. If not, infer logical sections from headers and structure.
Omit appendices unless they contain substantive requirements.
Return ONLY the JSON array, no other text."""

REQUIREMENTS_SYSTEM_PROMPT = """You are a compliance analyst reviewing a regulatory document. Extract every discrete, testable compliance requirement that an organization (e.g. a Managed Care Plan) could be audited against.

Return a JSON array. Each element must have:
- "text": the requirement stated as a clear, self-contained compliance obligation
- "reference": the section/subsection reference (e.g. "Section IV.1.A(2)(i)")

Rules:
- Each requirement should be independently testable -- avoid combining multiple obligations into one
- Include both explicit mandates ("MCPs must...") and conditional requirements ("If X, then MCP must...")
- Skip examples, background context, and definitions unless they contain an auditable obligation
- Be thorough -- extract ALL requirements, not just the most prominent ones
- Return ONLY the JSON array, no other text"""


@dataclass
class Section:
    title: str
    start_page: int
    end_page: int


def _get_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set")
    return genai.Client(api_key=api_key)


def _call_gemini(client: genai.Client, prompt: str, system: str) -> str:
    """Call Gemini with retries and exponential backoff."""
    for attempt in range(MAX_RETRIES):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    temperature=0.1,
                ),
            )
            return response.text or ""
        except (TransportError, ConnectionError, OSError) as e:
            if attempt == MAX_RETRIES - 1:
                raise
            wait = 2 ** attempt
            logger.warning(
                "Gemini API error (attempt %d/%d), retrying in %ds: %s",
                attempt + 1, MAX_RETRIES, wait, e,
            )
            time.sleep(wait)
    return ""


def _parse_json_response(text: str) -> list[dict] | None:
    """Parse a JSON array from Gemini's response, stripping markdown fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse Gemini JSON response: %s", cleaned[:300])
        return None

    if isinstance(data, dict):
        data = [data]
    if not isinstance(data, list):
        logger.error("Gemini response is not a JSON array: %s", type(data))
        return None

    return data


def detect_document_type(
    pages: list[tuple[int, str]],
) -> Literal["simple", "complex"]:
    """Classify a document as simple (numbered questionnaire) or complex (policy/regulatory doc).

    Uses structural heuristics -- this is the sole decision gate, not a regex fallback.
    """
    page_count = len(pages)
    full_text = "\n".join(text for _, text in pages)

    if page_count < 10:
        numbered_matches = re.findall(r"(?:^|\n)\s*\d{1,3}\.\s+", full_text)
        density = len(numbered_matches) / max(page_count, 1)
        if density > 1.0:
            return "simple"

    first_pages_text = "\n".join(text for _, text in pages[:3]).lower()
    has_toc = any(marker in first_pages_text for marker in [
        "table of contents",
        "contents\n",
    ])
    roman_headers = re.findall(
        r"(?:^|\n)\s*(?:I{1,3}|IV|VI{0,3}|IX|XI{0,3})\.\s+[A-Z]",
        "\n".join(text for _, text in pages[:5]),
    )
    has_roman_sections = len(roman_headers) >= 3

    if has_toc or has_roman_sections:
        return "complex"

    numbered_matches = re.findall(r"(?:^|\n)\s*\d{1,3}\.\s+", full_text)
    density = len(numbered_matches) / max(page_count, 1)
    if density > 1.0 and page_count < 30:
        return "simple"

    if page_count >= 50:
        return "complex"

    if page_count >= 15 and density < 0.5:
        return "complex"

    return "simple"


def extract_toc(
    pages: list[tuple[int, str]],
    client: genai.Client,
) -> list[Section]:
    """Send the first few pages to Gemini to extract a table of contents."""
    toc_pages = pages[:5]
    prompt = "Here are the first pages of a regulatory/policy document:\n\n"
    for page_num, text in toc_pages:
        prompt += f"--- Page {page_num} ---\n{text}\n\n"

    raw = _call_gemini(client, prompt, TOC_SYSTEM_PROMPT)
    if not raw.strip():
        logger.warning("Gemini returned empty TOC response, falling back to fixed chunks")
        return _fallback_sections(pages)

    data = _parse_json_response(raw)
    if not data:
        logger.warning("Could not parse TOC response, falling back to fixed chunks")
        return _fallback_sections(pages)

    sections: list[Section] = []
    for item in data:
        try:
            title = str(item.get("title", ""))
            start = int(item.get("start_page", 0))
            end = int(item.get("end_page", 0))
            if title and start > 0 and end >= start:
                sections.append(Section(title=title, start_page=start, end_page=end))
        except (ValueError, TypeError):
            continue

    if not sections:
        logger.warning("No valid sections extracted from TOC, falling back to fixed chunks")
        return _fallback_sections(pages)

    logger.info("Extracted %d sections from TOC", len(sections))
    return sections


def _fallback_sections(pages: list[tuple[int, str]]) -> list[Section]:
    """Create fixed-size 20-page sections when no TOC is available."""
    if not pages:
        return []

    first_page = pages[0][0]
    last_page = pages[-1][0]
    sections = []
    start = first_page

    while start <= last_page:
        end = min(start + MAX_PAGES_PER_CHUNK - 1, last_page)
        sections.append(Section(
            title=f"Pages {start}-{end}",
            start_page=start,
            end_page=end,
        ))
        start = end + 1

    return sections


def _chunk_section(section: Section) -> list[tuple[int, int, str]]:
    """Subdivide a section into (start_page, end_page, title) chunks with overlap."""
    span = section.end_page - section.start_page + 1
    if span <= MAX_PAGES_PER_CHUNK:
        return [(section.start_page, section.end_page, section.title)]

    chunks = []
    start = section.start_page
    while start <= section.end_page:
        end = min(start + MAX_PAGES_PER_CHUNK - 1, section.end_page)
        if chunks and start >= chunks[-1][0] and end <= chunks[-1][1]:
            break
        chunks.append((start, end, section.title))
        next_start = end - PAGE_OVERLAP + 1
        if next_start <= start:
            break
        start = next_start

    return chunks


def _pages_in_range(
    pages: list[tuple[int, str]],
    start_page: int,
    end_page: int,
) -> str:
    """Concatenate text from pages within the given range."""
    parts = []
    for page_num, text in pages:
        if start_page <= page_num <= end_page:
            parts.append(f"--- Page {page_num} ---\n{text}")
    return "\n\n".join(parts)


def _extract_requirements_from_chunk(
    pages_text: str,
    section_title: str,
    client: genai.Client,
) -> list[dict]:
    """Send one chunk of pages to Gemini and extract requirements."""
    prompt = (
        f'The following pages are from the section titled "{section_title}".\n\n'
        f"{pages_text}"
    )

    raw = _call_gemini(client, prompt, REQUIREMENTS_SYSTEM_PROMPT)
    if not raw.strip():
        logger.warning("Gemini returned empty response for section '%s'", section_title)
        return []

    data = _parse_json_response(raw)
    if not data:
        logger.warning("Could not parse requirements for section '%s'", section_title)
        return []

    return data


def extract_all_requirements(pdf_path: str) -> list[ParsedQuestion]:
    """Orchestrate the full LLM-based requirement extraction pipeline.

    1. Extract all pages
    2. Detect TOC and build section map
    3. Chunk sections with page overlap
    4. Extract requirements from each chunk via Gemini
    5. Number sequentially and return
    """
    source_doc = Path(pdf_path).name
    pages = extract_text_with_pages(pdf_path)
    if not pages:
        logger.error("No text extracted from %s", pdf_path)
        return []

    client = _get_client()

    logger.info("Extracting TOC from %s (%d pages)", source_doc, len(pages))
    sections = extract_toc(pages, client)
    time.sleep(1)

    all_chunks: list[tuple[int, int, str]] = []
    for section in sections:
        all_chunks.extend(_chunk_section(section))

    logger.info(
        "Processing %d chunks across %d sections for %s",
        len(all_chunks), len(sections), source_doc,
    )

    requirements: list[ParsedQuestion] = []
    req_number = 1

    for i, (start_page, end_page, section_title) in enumerate(all_chunks):
        logger.info(
            "[%d/%d] Extracting requirements from '%s' (pages %d-%d)",
            i + 1, len(all_chunks), section_title, start_page, end_page,
        )

        pages_text = _pages_in_range(pages, start_page, end_page)
        if not pages_text.strip():
            continue

        raw_reqs = _extract_requirements_from_chunk(pages_text, section_title, client)

        for item in raw_reqs:
            text = str(item.get("text", "")).strip()
            reference = str(item.get("reference", "")).strip()
            if text:
                requirements.append(ParsedQuestion(
                    number=req_number,
                    text=text,
                    reference=reference,
                    section=section_title,
                    source_doc=source_doc,
                ))
                req_number += 1

        if i < len(all_chunks) - 1:
            time.sleep(1)

    logger.info(
        "Extracted %d requirements from %s", len(requirements), source_doc,
    )
    return requirements


def stream_requirements(pdf_path: str) -> Generator[dict, None, None]:
    """Stream requirement extraction events section-by-section.

    Yields dicts with a "type" key:
      - {"type": "toc", "sections": [title, ...]}
      - {"type": "extracting", "section": title}
      - {"type": "section", "section": title, "questions": [{...}, ...]}
    """
    source_doc = Path(pdf_path).name
    pages = extract_text_with_pages(pdf_path)
    if not pages:
        logger.error("No text extracted from %s", pdf_path)
        return

    from app.services.pdf_parser import parse_audit_questions

    doc_type = detect_document_type(pages)
    logger.info("Document classified as '%s' (%d pages)", doc_type, len(pages))

    if doc_type == "simple":
        questions = parse_audit_questions(pdf_path)
        yield {"type": "toc", "sections": ["All Requirements"]}
        yield {"type": "extracting", "section": "All Requirements"}
        yield {
            "type": "section",
            "section": "All Requirements",
            "questions": [q.model_dump() for q in questions],
        }
        return

    client = _get_client()

    logger.info("Extracting TOC from %s (%d pages)", source_doc, len(pages))
    sections = extract_toc(pages, client)
    time.sleep(1)

    section_chunks: OrderedDict[str, list[tuple[int, int]]] = OrderedDict()
    for section in sections:
        chunks = _chunk_section(section)
        section_chunks[section.title] = [(s, e) for s, e, _ in chunks]

    yield {"type": "toc", "sections": list(section_chunks.keys())}

    req_number = 1

    for section_title, chunks in section_chunks.items():
        yield {"type": "extracting", "section": section_title}

        section_reqs: list[dict] = []

        for i, (start_page, end_page) in enumerate(chunks):
            logger.info(
                "Extracting requirements from '%s' (pages %d-%d)",
                section_title, start_page, end_page,
            )

            pages_text = _pages_in_range(pages, start_page, end_page)
            if not pages_text.strip():
                continue

            raw_reqs = _extract_requirements_from_chunk(
                pages_text, section_title, client,
            )

            for item in raw_reqs:
                text = str(item.get("text", "")).strip()
                reference = str(item.get("reference", "")).strip()
                if text:
                    section_reqs.append(ParsedQuestion(
                        number=req_number,
                        text=text,
                        reference=reference,
                        section=section_title,
                        source_doc=source_doc,
                    ).model_dump())
                    req_number += 1

            if i < len(chunks) - 1:
                time.sleep(1)

        yield {
            "type": "section",
            "section": section_title,
            "questions": section_reqs,
        }

        time.sleep(1)

    logger.info(
        "Streamed %d requirements from %s", req_number - 1, source_doc,
    )
