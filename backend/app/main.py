import json
import logging
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAIError
from pydantic import ValidationError

from .ai import AIService
from .models import (
    ChatReply,
    ChatRequest,
    ClassificationResult,
    Health,
    MessageRequest,
    OrderExtraction,
    ReplyRequest,
    ReplyResult,
    Task,
    TaskBatchCreate,
    TaskBatchResult,
    TaskStatus,
    TaskUpdate,
)
from .rules import CUSTOMER_SERVICE_WARNING, PROVIDER_WARNING, classify_message, draft_reply, extract_order
from .settings import Settings
from .storage import TaskStore

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None, ai_service: AIService | None = None) -> FastAPI:
    config = settings or Settings.from_env()
    store = TaskStore(config.database_path)
    ai = ai_service or AIService(config)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        store.initialize()
        yield
        await ai.close()

    app = FastAPI(
        title="BizPilot AI — Business Agent",
        description="Classify customer messages, draft replies, review order tasks, and manage a saved task list.",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.state.task_store = store
    app.state.ai_service = ai
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(config.cors_origins),
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(sqlite3.Error)
    async def storage_error(request, exc):
        logger.error("Task storage operation failed (%s)", type(exc).__name__)
        return JSONResponse(
            status_code=503, content={"detail": "Task storage is temporarily unavailable. Please try again."}
        )

    @app.get("/health", response_model=Health)
    async def health():
        return Health(ai_configured=ai.configured)

    @app.post("/api/classify", response_model=ClassificationResult)
    async def classify(payload: MessageRequest):
        if ai.configured:
            try:
                result = await ai.classify(payload.message)
                return ClassificationResult(**result.model_dump(), engine="groq")
            except (OpenAIError, ValidationError, ValueError, TypeError) as exc:
                logger.warning("Classification fell back to rules (%s)", type(exc).__name__)
        result = classify_message(payload.message)
        return ClassificationResult(
            **result.model_dump(),
            engine="rules",
            warning=PROVIDER_WARNING if ai.configured else CUSTOMER_SERVICE_WARNING,
        )

    @app.post("/api/replies", response_model=ReplyResult)
    async def reply(payload: ReplyRequest):
        if ai.configured:
            try:
                result = await ai.draft(payload.message, payload.tone, payload.business_name)
                return ReplyResult(
                    **result.model_dump(),
                    category=classify_message(payload.message).category,
                    engine="groq",
                )
            except (OpenAIError, ValidationError, ValueError, TypeError) as exc:
                logger.warning("Reply drafting fell back to rules (%s)", type(exc).__name__)
        result = draft_reply(payload.message, payload.tone, payload.business_name)
        if ai.configured:
            result.warning = PROVIDER_WARNING
        return result

    @app.post("/api/orders/extract", response_model=OrderExtraction)
    async def extract(payload: MessageRequest):
        if ai.configured:
            try:
                result = await ai.extract_order(payload.message)
                return OrderExtraction(
                    **result.model_dump(),
                    missing_fields=missing_order_fields(
                        result.order_reference, result.customer_name, bool(result.items)
                    ),
                    engine="groq",
                )
            except (OpenAIError, ValidationError, ValueError, TypeError) as exc:
                logger.warning("Order extraction fell back to rules (%s)", type(exc).__name__)
        result = extract_order(payload.message)
        if ai.configured:
            result.warning = PROVIDER_WARNING
        return result

    @app.post("/api/chat", response_model=ChatReply)
    async def chat(payload: ChatRequest):
        if not ai.configured:
            raise HTTPException(
                status_code=503,
                detail="AI chat needs a Groq API key. Add GROQ_API_KEY to backend/.env and restart the server. "
                "Message classification, reply drafts, and order tasks also work with local rules.",
            )
        try:
            content = await ai.chat(payload.message, [message.model_dump() for message in payload.history])
            result = json.loads(content)
            if (
                not isinstance(result, dict)
                or not isinstance(result.get("reply"), str)
                or not result["reply"].strip()
            ):
                raise ValueError("Invalid chat response")
            return ChatReply(reply=result["reply"].strip())
        except (OpenAIError, ValidationError, ValueError, TypeError) as exc:
            logger.warning("Chat request failed (%s)", type(exc).__name__)
            raise HTTPException(
                status_code=502,
                detail="The AI provider could not complete this request. Check your Groq key, model, and quota, "
                "then try again. Your message has not been sent to a customer.",
            ) from None

    @app.get("/api/tasks", response_model=list[Task])
    async def list_tasks(status: TaskStatus | None = None):
        return store.list_tasks(status)

    @app.post("/api/tasks", response_model=TaskBatchResult, status_code=201)
    async def create_tasks(payload: TaskBatchCreate, response: Response):
        result = store.create_many(payload.tasks)
        if not result.created_count:
            response.status_code = 200
        return result

    @app.patch("/api/tasks/{task_id}", response_model=Task)
    async def update_task(task_id: str, payload: TaskUpdate):
        task = store.update(task_id, payload)
        if task is None:
            raise HTTPException(status_code=404, detail="This task no longer exists. Refresh your task list.")
        return task

    @app.delete("/api/tasks/{task_id}", status_code=204)
    async def delete_task(task_id: str):
        if not store.delete(task_id):
            raise HTTPException(status_code=404, detail="This task no longer exists. Refresh your task list.")
        return Response(status_code=204)

    return app


def missing_order_fields(reference: str | None, customer: str | None, has_items: bool) -> list[str]:
    return [
        label
        for label, missing in [
            ("order reference", not reference),
            ("customer name", not customer),
            ("items and quantities", not has_items),
        ]
        if missing
    ]


app = create_app()
