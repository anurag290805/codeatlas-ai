"""Async Gemini language-model service for CodeAtlas AI."""

from __future__ import annotations

import json
import time
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Mapping
from dataclasses import dataclass
from enum import Enum
from typing import Any, Protocol

import httpx
from loguru import logger
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import Settings, get_settings


class LLMProviderName(str, Enum):
    GEMINI = "gemini"


class ResponseFormat(str, Enum):
    MARKDOWN = "markdown"
    JSON = "json"


class LLMServiceError(Exception):
    """Base exception for LLM service failures."""


class LLMInvalidPromptError(LLMServiceError): pass
class LLMTimeoutError(LLMServiceError): pass
class LLMProviderOutageError(LLMServiceError): pass
class LLMModelNotFoundError(LLMServiceError): pass
class LLMMalformedResponseError(LLMServiceError): pass
class LLMContextOverflowError(LLMServiceError): pass
class LLMRateLimitError(LLMServiceError): pass
class LLMAuthenticationError(LLMServiceError): pass


@dataclass(frozen=True)
class GeminiHealth:
    reachable: bool
    model_available: bool
    message: str


class UsageMetadata(BaseModel):
    prompt_tokens: int = Field(default=0, ge=0)
    completion_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)


class Citation(BaseModel):
    model_config = ConfigDict(frozen=True)
    file_path: str = Field(min_length=1)
    start_line: int = Field(ge=1)
    end_line: int = Field(ge=1)
    symbol_name: str | None = None

    @field_validator("end_line")
    @classmethod
    def validate_line_range(cls, value: int, info) -> int:
        start_line = info.data.get("start_line")
        if start_line is not None and value < start_line:
            raise ValueError("end_line must be greater than or equal to start_line")
        return value


class LLMRequest(BaseModel):
    query: str = Field(min_length=1)
    context: str = ""
    citations: tuple[Citation, ...] = ()
    model: str | None = Field(default=None, min_length=1)
    temperature: float = Field(default=0.0, ge=0.0, le=2.0)
    max_tokens: int = Field(default=256, gt=0)
    response_format: ResponseFormat = ResponseFormat.MARKDOWN

    @field_validator("query")
    @classmethod
    def validate_query(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("query must not be blank")
        return value


class LLMResponse(BaseModel):
    answer: str
    citations: tuple[Citation, ...] = ()
    provider: LLMProviderName = LLMProviderName.GEMINI
    model: str
    usage: UsageMetadata | None = None
    latency_seconds: float = Field(ge=0)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)

    @property
    def token_usage(self) -> UsageMetadata | None: return self.usage
    @property
    def response_format(self) -> ResponseFormat:
        return ResponseFormat.JSON if self.answer.startswith("{") else ResponseFormat.MARKDOWN


class LLMStreamChunk(BaseModel):
    delta: str = ""
    is_final: bool = False
    provider: LLMProviderName = LLMProviderName.GEMINI
    model: str
    usage: UsageMetadata | None = None

    @property
    def token_usage(self) -> UsageMetadata | None: return self.usage


class _AsyncClient(Protocol):
    async def post(self, url: str, **kwargs: Any) -> httpx.Response: ...
    async def get(self, url: str, **kwargs: Any) -> httpx.Response: ...
    async def aclose(self) -> None: ...


class AbstractLLMProvider(ABC):
    provider_name: LLMProviderName
    @abstractmethod
    async def generate(self, request: LLMRequest) -> tuple[str, UsageMetadata | None]: ...
    @abstractmethod
    async def generate_stream(self, request: LLMRequest) -> AsyncIterator[LLMStreamChunk]: ...


class GeminiProvider(AbstractLLMProvider):
    """Provider implementation for Google's Gemini generateContent API."""

    _BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
    _GROUNDING_SYSTEM_PROMPT = (
        "You are CodeAtlas AI, a repository code assistant. Answer using the "
        "provided repository context when relevant. Do not claim the repository "
        "is unavailable when context is present. If the context lacks evidence, "
        "say what is missing."
    )
    provider_name = LLMProviderName.GEMINI

    def __init__(self, settings: Settings | None = None, client: _AsyncClient | None = None) -> None:
        self._settings = settings or get_settings()
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(base_url=self._BASE_URL, timeout=httpx.Timeout(self._settings.gemini_timeout_seconds))
        logger.info("Initialized Gemini provider model={}", self._settings.gemini_model)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def check_health(self, timeout_seconds: float = 5.0) -> GeminiHealth:
        if not self._settings.gemini_api_key:
            return GeminiHealth(False, False, "Gemini API credentials are not configured.")
        try:
            response = await self._client.get(f"/models/{self._settings.gemini_model}", params={"key": self._settings.gemini_api_key}, timeout=timeout_seconds)
            self._validate_status(response)
            return GeminiHealth(True, True, "Gemini and the configured model are available.")
        except LLMServiceError as exc:
            return GeminiHealth(False, False, str(exc))
        except httpx.TimeoutException:
            return GeminiHealth(False, False, "Gemini health check timed out. Please retry.")
        except httpx.RequestError:
            return GeminiHealth(False, False, "Gemini is unavailable. Please retry shortly.")

    async def generate(self, request: LLMRequest) -> tuple[str, UsageMetadata | None]:
        if not self._settings.gemini_api_key:
            raise LLMAuthenticationError("Gemini API credentials are not configured.")
        model = request.model or self._settings.gemini_model
        try:
            response = await self._client.post(f"/models/{model}:generateContent", params={"key": self._settings.gemini_api_key}, json=self._payload(request))
        except httpx.TimeoutException as exc:
            raise LLMTimeoutError("Gemini generation timed out. Please retry.") from exc
        except httpx.RequestError as exc:
            raise LLMProviderOutageError("Gemini could not be reached. Please retry shortly.") from exc
        data = self._parse_response(response)
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMMalformedResponseError("Gemini response did not contain answer text.") from exc
        usage = data.get("usageMetadata")
        return text, self._usage(usage) if isinstance(usage, Mapping) else None

    async def generate_stream(self, request: LLMRequest) -> AsyncIterator[LLMStreamChunk]:
        text, usage = await self.generate(request)
        yield LLMStreamChunk(delta=text, is_final=True, model=request.model or self._settings.gemini_model, usage=usage)

    def _payload(self, request: LLMRequest) -> dict[str, Any]:
        prompt = request.query if not request.context else f"Repository context:\n{request.context}\n\nQuestion: {request.query}"
        generation_config: dict[str, Any] = {"temperature": request.temperature, "maxOutputTokens": min(request.max_tokens, self._settings.gemini_max_tokens)}
        if request.response_format is ResponseFormat.JSON:
            generation_config["responseMimeType"] = "application/json"
        return {"systemInstruction": {"parts": [{"text": self._GROUNDING_SYSTEM_PROMPT}]}, "contents": [{"role": "user", "parts": [{"text": prompt}]}], "generationConfig": generation_config}

    @staticmethod
    def _usage(data: Mapping[str, Any]) -> UsageMetadata:
        prompt = int(data.get("promptTokenCount", 0) or 0)
        completion = int(data.get("candidatesTokenCount", 0) or 0)
        return UsageMetadata(prompt_tokens=prompt, completion_tokens=completion, total_tokens=int(data.get("totalTokenCount", prompt + completion) or 0))

    @classmethod
    def _parse_response(cls, response: httpx.Response) -> dict[str, Any]:
        cls._validate_status(response)
        try:
            data = response.json()
        except (ValueError, json.JSONDecodeError) as exc:
            raise LLMMalformedResponseError("Gemini returned invalid JSON.") from exc
        if not isinstance(data, dict):
            raise LLMMalformedResponseError("Gemini response was not a JSON object.")
        return data

    @staticmethod
    def _validate_status(response: httpx.Response) -> None:
        if response.status_code in {401, 403}:
            raise LLMAuthenticationError("Gemini API credentials were rejected.")
        if response.status_code == 404:
            raise LLMModelNotFoundError("The configured Gemini model was not found.")
        if response.status_code == 429:
            raise LLMRateLimitError("Gemini is rate limiting requests. Please retry shortly.")
        if response.status_code >= 500:
            raise LLMProviderOutageError("Gemini is temporarily unavailable.")
        if response.status_code >= 400:
            raise LLMMalformedResponseError("Gemini rejected the request.")


class LLMService:
    """Validate requests and orchestrate grounded Gemini generation."""

    def __init__(self, provider: AbstractLLMProvider | None = None, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._provider = provider or GeminiProvider(self._settings)
        self.provider_name = LLMProviderName.GEMINI
        self.model_name = self._settings.gemini_model

    def is_ready(self) -> bool:
        return bool(self._settings.gemini_api_key and self.model_name)

    async def check_health(self) -> GeminiHealth:
        if not isinstance(self._provider, GeminiProvider):
            return GeminiHealth(self.is_ready(), self.is_ready(), "Gemini provider is configured.")
        return await self._provider.check_health()

    async def generate(self, request: LLMRequest) -> LLMResponse:
        self._validate_request(request)
        started = time.perf_counter()
        text, usage = await self._provider.generate(request)
        response = self._build_response(request, text, usage, time.perf_counter() - started)
        logger.info("Gemini generation completed model={} latency_seconds={:.3f}", response.model, response.latency_seconds)
        return response

    async def generate_stream(self, request: LLMRequest) -> AsyncIterator[LLMStreamChunk]:
        self._validate_request(request)
        async for chunk in self._provider.generate_stream(request):
            yield chunk

    async def generate_answer(self, retrieval_result: Any, response_format: ResponseFormat = ResponseFormat.MARKDOWN) -> LLMResponse:
        return await self.generate(self.request_from_retrieval(retrieval_result, response_format=response_format))

    async def generate_answer_stream(self, retrieval_result: Any) -> AsyncIterator[LLMStreamChunk]:
        async for chunk in self.generate_stream(self.request_from_retrieval(retrieval_result)):
            yield chunk

    @staticmethod
    def request_from_retrieval(retrieval_result: Any, *, response_format: ResponseFormat = ResponseFormat.MARKDOWN) -> LLMRequest:
        query = getattr(retrieval_result, "query", getattr(retrieval_result, "query_text", ""))
        if hasattr(query, "text"):
            query = query.text
        context = getattr(retrieval_result, "assembled_context", "")
        if hasattr(context, "chunks"):
            context = "\n\n".join(str(chunk.code) for chunk in context.chunks)
        citations = tuple(Citation.model_validate(c, from_attributes=True) for c in getattr(retrieval_result, "citations", ()))
        return LLMRequest(query=query, context=str(context), citations=citations, response_format=response_format)

    def _validate_request(self, request: LLMRequest) -> None:
        estimated = (len(request.query) + len(request.context)) // 4
        if estimated + request.max_tokens > self._settings.retrieval_token_budget * 2:
            raise LLMContextOverflowError("LLM prompt exceeds the configured context budget")

    def _build_response(self, request: LLMRequest, text: str, usage: UsageMetadata | None, latency: float) -> LLMResponse:
        if request.response_format is ResponseFormat.JSON:
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError as exc:
                raise LLMMalformedResponseError("Gemini JSON response could not be decoded.") from exc
            if not isinstance(parsed, dict) or not isinstance(parsed.get("answer"), str):
                raise LLMMalformedResponseError("Gemini JSON response must contain an answer.")
            text = parsed["answer"]
        return LLMResponse(answer=text.strip(), citations=request.citations, model=request.model or self.model_name, usage=usage, latency_seconds=max(0.0, latency))
