from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Category = Literal["order", "complaint", "refund", "inquiry", "feedback", "other"]
Priority = Literal["low", "normal", "high", "urgent"]
TaskStatus = Literal["todo", "in_progress", "done"]
Engine = Literal["groq", "rules"]
Tone = Literal["professional", "friendly", "concise"]
MessageText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class MessageRequest(InputModel):
    message: MessageText


class Classification(InputModel):
    category: Category
    priority: Priority
    sentiment: Literal["positive", "neutral", "negative"]
    summary: str = Field(min_length=1, max_length=1000)
    suggested_action: str = Field(min_length=1, max_length=1000)


class ClassificationResult(Classification):
    engine: Engine
    warning: str | None = None


class ReplyRequest(MessageRequest):
    tone: Tone = "professional"
    business_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ""


class ReplyOutput(InputModel):
    draft: str = Field(min_length=1, max_length=6000)


class ReplyResult(ReplyOutput):
    category: Category
    engine: Engine
    warning: str | None = None


class OrderItem(InputModel):
    name: ShortText
    quantity: int = Field(ge=1, le=10000)


class TaskCreate(InputModel):
    title: ShortText
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=6000)] = ""
    priority: Priority = "normal"
    order_reference: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = None
    due_date: date | None = None


class Task(TaskCreate):
    id: str
    status: TaskStatus = "todo"
    created_at: datetime
    updated_at: datetime


class TaskUpdate(InputModel):
    status: TaskStatus


class TaskBatchCreate(InputModel):
    tasks: list[TaskCreate] = Field(min_length=1, max_length=50)


class TaskBatchResult(BaseModel):
    tasks: list[Task]
    created_count: int
    skipped_count: int


class OrderDraft(InputModel):
    order_reference: str | None = Field(default=None, max_length=80)
    customer_name: str | None = Field(default=None, max_length=200)
    items: list[OrderItem] = Field(default_factory=list, max_length=50)
    tasks: list[TaskCreate] = Field(default_factory=list, max_length=50)


class OrderExtraction(OrderDraft):
    missing_fields: list[str]
    engine: Engine
    warning: str | None = None


class ChatMessage(InputModel):
    role: Literal["user", "assistant"]
    content: MessageText


class ChatRequest(MessageRequest):
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


class ChatReply(BaseModel):
    reply: str
    engine: Literal["groq"] = "groq"


class Health(BaseModel):
    status: Literal["ok"] = "ok"
    ai_configured: bool
    task_storage: Literal["sqlite"] = "sqlite"
