from pydantic import BaseModel


class UploadResponse(BaseModel):
    file_id: str
    filename: str
    metadata: dict


class ParseRequest(BaseModel):
    file_id: str


class ParsedQuestion(BaseModel):
    number: int
    text: str
    reference: str


class ParseResponse(BaseModel):
    questions: list[ParsedQuestion]


class AnalyzeRequest(BaseModel):
    questions: list[ParsedQuestion]
    policy_file_ids: list[str]


class AnalysisResult(BaseModel):
    question_number: int
    status: str  # met, not_met, partial
    evidence: str
    policy_source: str
    page: str
    confidence: str  # high, medium, low
