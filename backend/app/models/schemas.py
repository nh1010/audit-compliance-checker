from pydantic import BaseModel


class UploadResponse(BaseModel):
    file_id: str
    filename: str


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


class AnalysisResult(BaseModel):
    question_number: int
    status: str  # met, not_met, partial
    evidence: str
    policy_source: str
    page: str
    confidence: str  # high, medium, low
    reason: str  # why the requirement is not_met or partial; empty for met
