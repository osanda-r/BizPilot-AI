
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI, OpenAIError
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).with_name(".env"))

logger = logging.getLogger(__name__)

app = FastAPI(title="AI Business Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

api_key = os.getenv("GROQ_API_KEY")

client = AsyncOpenAI(
    api_key=api_key,
    base_url="https://api.groq.com/openai/v1",
) if api_key else None

SYSTEM_PROMPT = """
You are a professional AI Business Assistant.

You help small businesses with:
- Customer support
- Business questions
- Writing professional replies
- Summarizing customer messages
- Suggesting business tasks

Never invent order information or claim
to have completed actions you haven't done.
"""

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Groq API key is not configured"
        )

    try:
        completion = await client.chat.completions.create(
            model=os.getenv(
                "GROQ_MODEL",
                "llama-3.3-70b-versatile"
            ),
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": request.message
                }
            ],
            max_tokens=500,
        )

        reply = completion.choices[0].message.content

        return {"reply": reply or "No response generated."}

    except OpenAIError:
        logger.exception("Groq API request failed")
        raise HTTPException(
            status_code=502,
            detail="Groq API request failed"
        )
