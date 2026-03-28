from typing import Literal

from pydantic import BaseModel

Status = Literal["met", "not_met", "partial"]
Confidence = Literal["high", "medium", "low"]


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
    status: Status
    evidence: str
    policy_source: str
    page: str
    confidence: Confidence
    reason: str
