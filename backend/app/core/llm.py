"""Async Ollama-backed language-model service for CodeAtlas AI.

The module deliberately has one provider implementation and no cloud-provider
SDK dependencies.  ``OllamaProvider`` communicates with Ollama's local REST
API, while ``LLMService`` owns validation, prompt construction, response
normalization, and dependency injection.
"""

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
    """Supported local language-model provider."""

    OLLAMA = "ollama"


class ResponseFormat(str, Enum):
    """Output formats supported by Ollama generation."""

    MARKDOWN = "markdown"
    JSON = "json"


class LLMServiceError(Exception):
    """Base exception for all LLM service failures."""


class LLMInvalidPromptError(LLMServiceError):
    """Raised when an LLM request contains unusable input."""


class LLMTimeoutError(LLMServiceError):
    """Raised when Ollama does not respond within the configured timeout."""


class LLMProviderOutageError(LLMServiceError):
    """Raised when Ollama cannot be reached or returns a server failure."""


class LLMModelNotFoundError(LLMServiceError):
    """Raised when the configured Ollama model is unavailable."""


class LLMMalformedResponseError(LLMServiceError):
    """Raised when Ollama returns invalid or incomplete JSON."""


class LLMContextOverflowError(LLMServiceError):
    """Raised when the request exceeds the configured prompt limit."""


class LLMRateLimitError(LLMServiceError):
    """Compatibility exception for provider throttling responses."""


class LLMAuthenticationError(LLMServiceError):
    """Compatibility exception for rejected provider access."""


@dataclass(frozen=True)
class OllamaHealth:
    """Safe, non-sensitive status from an Ollama readiness probe."""

    reachable: bool
    model_available: bool
    message: str


class UsageMetadata(BaseModel):
    """Token accounting returned by Ollama when available."""

    prompt_tokens: int = Field(default=0, ge=0)
    completion_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)


class Citation(BaseModel):
    """A source location that grounds an answer."""

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
    """Validated input for one grounded generation request."""

    query: str = Field(min_length=1)
    context: str = Field(default="")
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
    """Normalized response returned by ``LLMService.generate``."""

    answer: str
    citations: tuple[Citation, ...] = ()
    provider: LLMProviderName = LLMProviderName.OLLAMA
    model: str
    usage: UsageMetadata | None = None
    latency_seconds: float = Field(ge=0)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)

    @property
    def token_usage(self) -> UsageMetadata | None:
        """Compatibility alias used by existing query orchestration."""
        return self.usage

    @property
    def response_format(self) -> ResponseFormat:
        """Return JSON when the answer is a parsed structured object."""
        return ResponseFormat.JSON if self.answer.startswith("{") else ResponseFormat.MARKDOWN


class LLMStreamChunk(BaseModel):
    """One normalized incremental Ollama response."""

    delta: str = ""
    is_final: bool = False
    provider: LLMProviderName = LLMProviderName.OLLAMA
    model: str
    usage: UsageMetadata | None = None

    @property
    def token_usage(self) -> UsageMetadata | None:
        return self.usage


class _AsyncClient(Protocol):
    async def post(self, url: str, **kwargs: Any) -> httpx.Response: ...

    async def get(self, url: str, **kwargs: Any) -> httpx.Response: ...

    async def aclose(self) -> None: ...


class AbstractLLMProvider(ABC):
    """Async provider contract used by ``LLMService``."""

    provider_name: LLMProviderName

    @abstractmethod
    async def generate(self, request: LLMRequest) -> tuple[str, UsageMetadata | None]:
        """Generate one complete response."""

    @abstractmethod
    async def generate_stream(self, request: LLMRequest) -> AsyncIterator[LLMStreamChunk]:
        """Yield response deltas as Ollama emits them."""


class OllamaProvider(AbstractLLMProvider):
    """Provider implementation for Ollama's ``/api/generate`` endpoint."""

    _GROUNDING_SYSTEM_PROMPT = (
        "You are CodeAtlas AI, a repository code assistant. Answer using the "
        "provided repository context when it is relevant. Do not claim that "
        "the repository is unavailable when context is present. If the "
        "context does not contain enough evidence, say what is missing."
    )

    provider_name = LLMProviderName.OLLAMA

    def __init__(
        self,
        settings: Settings | None = None,
        client: _AsyncClient | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            base_url=self._settings.ollama_base_url,
            timeout=httpx.Timeout(self._settings.ollama_timeout_seconds),
        )
        logger.info("Initialized Ollama provider model={}", self._settings.ollama_model)

    async def aclose(self) -> None:
        """Close the internally owned HTTP client."""
        if self._owns_client:
            await self._client.aclose()

    async def check_health(self, timeout_seconds: float = 5.0) -> OllamaHealth:
        """Check Ollama reachability and whether the configured model is installed."""
        try:
            response = await self._client.get("/api/tags", timeout=timeout_seconds)
            if response.status_code >= 400:
                return OllamaHealth(
                    reachable=False,
                    model_available=False,
                    message="Ollama responded with an error. Verify the local Ollama service.",
                )
            data = response.json()
            models = data.get("models", []) if isinstance(data, dict) else []
            names = {
                str(model.get("name"))
                for model in models
                if isinstance(model, dict) and model.get("name")
            }
            if self._settings.ollama_model not in names:
                return OllamaHealth(
                    reachable=True,
                    model_available=False,
                    message=(
                        "Ollama is reachable, but the configured model is missing. "
                        "Pull the configured model before using AI Chat."
                    ),
                )
            return OllamaHealth(
                reachable=True,
                model_available=True,
                message="Ollama and the configured model are available.",
            )
        except httpx.TimeoutException:
            return OllamaHealth(
                reachable=False,
                model_available=False,
                message="Ollama health check timed out. Verify the local Ollama service.",
            )
        except (httpx.RequestError, ValueError, TypeError):
            return OllamaHealth(
                reachable=False,
                model_available=False,
                message="Ollama is unavailable. Start Ollama before using AI Chat.",
            )

    async def generate(self, request: LLMRequest) -> tuple[str, UsageMetadata | None]:
        """Call Ollama and return response text plus token usage."""
        payload = self._payload(request, stream=False)
        try:
            response = await self._client.post("/api/generate", json=payload)
        except httpx.TimeoutException as exc:
            raise LLMTimeoutError(
                f"Ollama generation timed out after {self._settings.ollama_timeout_seconds:g}s "
                f"at {self._settings.ollama_base_url}"
            ) from exc
        except httpx.RequestError as exc:
            raise LLMProviderOutageError(
                f"Ollama could not be reached at {self._settings.ollama_base_url}. "
                "Start Ollama and confirm the configured model is installed."
            ) from exc

        data = self._parse_response(response)
        text = data.get("response")
        if not isinstance(text, str):
            raise LLMMalformedResponseError("Ollama response did not contain text")
        return text, self._usage(data)

    async def generate_stream(self, request: LLMRequest) -> AsyncIterator[LLMStreamChunk]:
        """Stream newline-delimited JSON objects from Ollama."""
        payload = self._payload(request, stream=True)
        try:
            async with self._client.stream("POST", "/api/generate", json=payload) as response:  # type: ignore[attr-defined]
                self._validate_status(response)
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError as exc:
                        raise LLMMalformedResponseError("Ollama returned invalid stream JSON") from exc
                    if not isinstance(data, dict):
                        raise LLMMalformedResponseError("Ollama stream item was not an object")
                    error = data.get("error")
                    if error:
                        raise self._error_from_provider_message(str(error))
                    yield LLMStreamChunk(
                        delta=str(data.get("response", "")),
                        is_final=bool(data.get("done", False)),
                        model=request.model or self._settings.ollama_model,
                        usage=self._usage(data),
                    )
        except httpx.TimeoutException as exc:
            raise LLMTimeoutError(
                f"Ollama streaming timed out after {self._settings.ollama_timeout_seconds:g}s "
                f"at {self._settings.ollama_base_url}"
            ) from exc
        except httpx.RequestError as exc:
            raise LLMProviderOutageError(
                f"Ollama could not be reached at {self._settings.ollama_base_url}. "
                "Start Ollama and confirm the configured model is installed."
            ) from exc

    def _payload(self, request: LLMRequest, *, stream: bool) -> dict[str, Any]:
        prompt = request.context
        if prompt:
            prompt = f"Repository context:\n{prompt}\n\nQuestion: {request.query}"
        else:
            prompt = request.query
        logger.info(
            "Ollama request prepared model={} context_chars={} prompt_chars={} citations={}",
            request.model or self._settings.ollama_model,
            len(request.context),
            len(prompt),
            len(request.citations),
        )
        payload: dict[str, Any] = {
            "model": request.model or self._settings.ollama_model,
            "prompt": prompt,
            "system": self._GROUNDING_SYSTEM_PROMPT,
            "stream": stream,
            "options": {
                "temperature": request.temperature,
                "num_predict": min(request.max_tokens, self._settings.ollama_max_tokens),
                "num_ctx": self._settings.ollama_num_ctx,
            },
        }
        if request.response_format is ResponseFormat.JSON:
            payload["format"] = "json"
        return payload

    @staticmethod
    def _usage(data: Mapping[str, Any]) -> UsageMetadata | None:
        prompt = data.get("prompt_eval_count")
        completion = data.get("eval_count")
        if prompt is None and completion is None:
            return None
        prompt_tokens = int(prompt or 0)
        completion_tokens = int(completion or 0)
        return UsageMetadata(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        )

    @classmethod
    def _parse_response(cls, response: httpx.Response) -> dict[str, Any]:
        cls._validate_status(response)
        try:
            data = response.json()
        except (ValueError, json.JSONDecodeError) as exc:
            raise LLMMalformedResponseError("Ollama returned invalid JSON") from exc
        if not isinstance(data, dict):
            raise LLMMalformedResponseError("Ollama response was not a JSON object")
        if data.get("error"):
            raise cls._error_from_provider_message(str(data["error"]))
        return data

    @staticmethod
    def _error_from_provider_message(message: str) -> LLMServiceError:
        if "not found" in message.lower() or "model" in message.lower() and "exist" in message.lower():
            return LLMModelNotFoundError(
                "Configured Ollama model was not found. Install it with `ollama pull <OLLAMA_MODEL>`."
            )
        return LLMProviderOutageError(
            "Ollama returned an error while generating the answer. Verify the local Ollama service."
        )

    @staticmethod
    def _validate_status(response: httpx.Response) -> None:
        if response.status_code == 404:
            raise LLMModelNotFoundError(
                "Configured Ollama model was not found. "
                "Install it with `ollama pull <OLLAMA_MODEL>`."
            )
        if response.status_code == 429:
            raise LLMRateLimitError("Ollama rejected the request due to throttling")
        if response.status_code >= 500:
            raise LLMProviderOutageError(f"Ollama returned HTTP {response.status_code}")
        if response.status_code >= 400:
            raise LLMMalformedResponseError(f"Ollama returned HTTP {response.status_code}")


class LLMService:
    """Validate requests and orchestrate prompt generation through Ollama."""

    def __init__(
        self,
        provider: AbstractLLMProvider | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._provider = provider or OllamaProvider(self._settings)
        self.provider_name = self._provider.provider_name
        self.model_name = self._settings.ollama_model

    def is_ready(self) -> bool:
        """Return whether the service has a configured Ollama provider."""
        return self.provider_name is LLMProviderName.OLLAMA and bool(self.model_name)

    async def check_health(self) -> OllamaHealth:
        """Probe provider readiness without loading a model or generating text."""
        if not self.is_ready() or not isinstance(self._provider, OllamaProvider):
            return OllamaHealth(
                reachable=False,
                model_available=False,
                message="The LLM provider is not configured.",
            )
        return await self._provider.check_health()

    async def generate(self, request: LLMRequest) -> LLMResponse:
        """Generate and normalize one grounded answer."""
        self._validate_request(request)
        started = time.perf_counter()
        logger.info("LLM generation started provider={} model={}", self.provider_name.value, request.model or self.model_name)
        text, usage = await self._provider.generate(request)
        response = self._build_response(request, text, usage, time.perf_counter() - started)
        logger.info("LLM generation completed model={} latency_seconds={:.3f}", response.model, response.latency_seconds)
        return response

    async def generate_stream(self, request: LLMRequest) -> AsyncIterator[LLMStreamChunk]:
        """Validate a request and yield Ollama response chunks."""
        self._validate_request(request)
        async for chunk in self._provider.generate_stream(request):
            yield chunk

    async def generate_answer(self, retrieval_result: Any, response_format: ResponseFormat = ResponseFormat.MARKDOWN) -> LLMResponse:
        """Compatibility adapter from the retriever result to ``LLMRequest``."""
        request = self.request_from_retrieval(retrieval_result, response_format=response_format)
        return await self.generate(request)

    async def generate_answer_stream(self, retrieval_result: Any) -> AsyncIterator[LLMStreamChunk]:
        """Compatibility adapter for streaming a retriever result."""
        request = self.request_from_retrieval(retrieval_result)
        async for chunk in self.generate_stream(request):
            yield chunk

    @staticmethod
    def request_from_retrieval(retrieval_result: Any, *, response_format: ResponseFormat = ResponseFormat.MARKDOWN) -> LLMRequest:
        """Build a request from either the current or legacy retrieval shape."""
        query = getattr(retrieval_result, "query", getattr(retrieval_result, "query_text", ""))
        if hasattr(query, "text"):
            query = query.text
        context_value = getattr(retrieval_result, "assembled_context", "")
        if hasattr(context_value, "chunks"):
            context_value = "\n\n".join(str(chunk.code) for chunk in context_value.chunks)
        citations = tuple(Citation.model_validate(citation, from_attributes=True) for citation in getattr(retrieval_result, "citations", ()))
        return LLMRequest(query=query, context=str(context_value), citations=citations, response_format=response_format)

    def _validate_request(self, request: LLMRequest) -> None:
        if not request.query.strip():
            raise LLMInvalidPromptError("LLM query must not be blank")
        estimated = (len(request.query) + len(request.context)) // 4
        if estimated + request.max_tokens > self._settings.retrieval_token_budget * 2:
            raise LLMContextOverflowError("LLM prompt exceeds the configured context budget")

    def _build_response(self, request: LLMRequest, text: str, usage: UsageMetadata | None, latency: float) -> LLMResponse:
        if request.response_format is ResponseFormat.JSON:
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError as exc:
                raise LLMMalformedResponseError("Ollama JSON response could not be decoded") from exc
            if not isinstance(parsed, dict) or not isinstance(parsed.get("answer"), str):
                raise LLMMalformedResponseError("Ollama JSON response must contain an answer")
            text = parsed["answer"]
        return LLMResponse(
            answer=text.strip(),
            citations=request.citations,
            model=request.model or self.model_name,
            usage=usage,
            latency_seconds=max(0.0, latency),
        )
