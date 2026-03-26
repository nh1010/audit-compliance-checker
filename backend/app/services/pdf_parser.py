import re
import pdfplumber

from app.models.schemas import ParsedQuestion


def extract_text(pdf_path: str) -> str:
    """Extract full text from a PDF, page by page."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return "\n".join(pages)


def extract_text_with_pages(pdf_path: str) -> list[tuple[int, str]]:
    """Extract text from a PDF, returning (page_number, text) tuples."""
    result = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            text = page.extract_text()
            if text:
                result.append((i, text))
    return result


def parse_audit_questions(pdf_path: str) -> list[ParsedQuestion]:
    """Parse a DHCS-style audit questionnaire PDF into structured questions."""
    raw_text = extract_text(pdf_path)

    # Strip page markers and revision headers
    cleaned = re.sub(r"--\s*\d+\s*of\s*\d+\s*--", "", raw_text)
    cleaned = re.sub(r"Rev\.\s*\d{2}/\d{4}", "", cleaned)

    # Split on question numbers at line start: "1.", "2.", ... "64."
    # The pattern looks for a number followed by a dot and a space at a line boundary.
    parts = re.split(r"(?:^|\n)\s*(\d{1,3})\.\s+", cleaned)

    questions = []
    # parts[0] is the preamble, then alternating: number, body
    for i in range(1, len(parts) - 1, 2):
        num = int(parts[i])
        body = parts[i + 1].strip()

        # Extract reference: (Reference: APL ..., page ...)
        ref_match = re.search(r"\(Reference:\s*(.+?)\)", body, re.DOTALL)
        reference = ""
        if ref_match:
            reference = re.sub(r"\s+", " ", ref_match.group(1).strip())

        # Remove everything from (Reference:...) onward (Yes/No, Citation lines)
        question_text = body
        if ref_match:
            question_text = body[: ref_match.start()].strip()

        # Collapse internal whitespace from line wrapping
        question_text = re.sub(r"\s+", " ", question_text).strip()

        if question_text:
            questions.append(ParsedQuestion(
                number=num,
                text=question_text,
                reference=f"Reference: {reference}" if reference else "",
            ))

    return questions


def parse_policy_metadata(pdf_path: str) -> dict:
    """Extract metadata (policy_id, title) from the first page header of a policy PDF."""
    with pdfplumber.open(pdf_path) as pdf:
        if not pdf.pages:
            return {"policy_id": "", "title": ""}
        first_text = pdf.pages[0].extract_text() or ""

    policy_id = ""
    title = ""

    id_match = re.search(r"Policy:\s*(\S+)", first_text)
    if id_match:
        policy_id = id_match.group(1)

    title_match = re.search(r"Title:\s*(.+?)(?=Department:|Section:|CEO\s)", first_text, re.DOTALL)
    if title_match:
        title = re.sub(r"\s+", " ", title_match.group(1)).strip()

    # Fallback: use filename-style heuristics
    if not policy_id:
        fname_match = re.search(r"([A-Z]{2}\.\d{4})", pdf_path)
        if fname_match:
            policy_id = fname_match.group(1)

    return {"policy_id": policy_id, "title": title}
