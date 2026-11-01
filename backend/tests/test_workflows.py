import json

import httpx2
import pytest
from app.models import Classification, OrderDraft, ReplyOutput
from app.rules import classify_message, draft_reply, extract_order
from openai import APIConnectionError

ORDER = "Order reference: BP-2048\nCustomer: Alex Morgan\n2 x Handmade ceramic mug\n1 x Gift wrapping"


@pytest.mark.parametrize(
    ("message", "category", "priority"),
    [
        ("I want to order 2 mugs", "order", "normal"),
        ("My item arrived broken and I am unhappy", "complaint", "high"),
        ("Please refund my order, this is urgent", "refund", "urgent"),
        ("What are your opening hours?", "inquiry", "normal"),
        ("Thank you, excellent service!", "feedback", "positive"),
        ("Hello there", "other", "normal"),
    ],
)
def test_local_classification(message, category, priority):
    result = classify_message(message)
    assert result.category == category
    if category == "feedback":
        assert result.sentiment == priority
    else:
        assert result.priority == priority


def test_classification_api_without_key_is_explicitly_local(client):
    response = client.post("/api/classify", json={"message": "My order is damaged. Please help urgently."})
    assert response.status_code == 200
    result = response.json()
    assert result["category"] == "complaint"
    assert result["priority"] == "urgent"
    assert result["engine"] == "rules"
    assert "not AI" in result["warning"]


@pytest.mark.parametrize("tone", ["professional", "friendly", "concise"])
def test_reply_drafts_are_editable_text_not_sent_messages(client, tone):
    response = client.post(
        "/api/replies", json={"message": "I need a refund", "tone": tone, "business_name": "Mug Studio"}
    )
    assert response.status_code == 200
    result = response.json()
    assert "Mug Studio" in result["draft"]
    assert result["engine"] == "rules"
    assert "refund is not confirmed" in result["draft"] or tone == "concise"


def test_all_tones_do_not_confirm_refunds():
    for tone in ["professional", "friendly", "concise"]:
        draft = draft_reply("I need a refund", tone).draft.lower()
        assert "refund approved" not in draft
        assert "refund has been issued" not in draft


def test_order_extraction_preserves_explicit_details(client):
    response = client.post("/api/orders/extract", json={"message": ORDER})
    assert response.status_code == 200
    result = response.json()
    assert result["order_reference"] == "BP-2048"
    assert result["customer_name"] == "Alex Morgan"
    assert result["items"] == [
        {"name": "Handmade ceramic mug", "quantity": 2},
        {"name": "Gift wrapping", "quantity": 1},
    ]
    assert len(result["tasks"]) == 3
    assert result["missing_fields"] == []
    assert ORDER in result["tasks"][0]["description"]
    assert all(task["order_reference"] == "BP-2048" for task in result["tasks"])


def test_inline_order_items():
    result = extract_order("Order #A-12: I would like 2 blue mugs and 1 gift box, please.")
    assert result.order_reference == "A-12"
    assert [(item.quantity, item.name) for item in result.items] == [(2, "blue mugs"), (1, "gift box")]


def test_unknown_order_fields_are_not_invented(client):
    result = client.post("/api/orders/extract", json={"message": "Please can I place an order?"}).json()
    assert result["order_reference"] is None
    assert result["customer_name"] is None
    assert result["items"] == []
    assert result["missing_fields"] == ["order reference", "customer name", "items and quantities"]
    assert len(result["tasks"]) == 1
    assert result["tasks"][0]["due_date"] is None


def test_maximum_order_message_retained_in_review_task():
    message = ORDER + "\n" + "x" * (4000 - len(ORDER) - 1)
    result = extract_order(message)
    assert message in result.tasks[0].description


@pytest.mark.parametrize("message", ["", "   ", "\n\t", "x" * 4001])
@pytest.mark.parametrize("endpoint", ["/api/classify", "/api/replies", "/api/orders/extract", "/api/chat"])
def test_invalid_message_returns_422_not_500(client, endpoint, message):
    assert client.post(endpoint, json={"message": message}).status_code == 422


def test_missing_message_and_unknown_fields_rejected(client):
    assert client.post("/api/classify", json={}).status_code == 422
    assert client.post("/api/classify", json={"message": "Hi", "admin": True}).status_code == 422


def test_health_and_chat_key_errors_are_actionable(client):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok", "ai_configured": False, "task_storage": "sqlite"}
    chat = client.post("/api/chat", json={"message": "Hello"})
    assert chat.status_code == 503
    assert "GROQ_API_KEY" in chat.json()["detail"]
    assert "local rules" in chat.json()["detail"]


def test_ai_classification_and_draft_use_provider_when_available(ai_client, fake_ai):
    fake_ai.classify.return_value = Classification(
        category="inquiry",
        priority="normal",
        sentiment="neutral",
        summary="A question",
        suggested_action="Reply",
    )
    fake_ai.draft.return_value = ReplyOutput(draft="Here is a verified answer.")
    classification = ai_client.post("/api/classify", json={"message": "A question"}).json()
    assert classification["engine"] == "groq"
    assert classification["summary"] == "A question"
    reply = ai_client.post("/api/replies", json={"message": "A question"}).json()
    assert reply["engine"] == "groq"
    assert reply["draft"] == "Here is a verified answer."
    assert reply["warning"] is None


@pytest.mark.parametrize(
    ("endpoint", "method"),
    [("/api/classify", "classify"), ("/api/replies", "draft"), ("/api/orders/extract", "extract_order")],
)
def test_provider_failure_falls_back_with_warning(ai_client, fake_ai, endpoint, method):
    getattr(fake_ai, method).side_effect = APIConnectionError(
        request=httpx2.Request("POST", "https://example.test")
    )
    response = ai_client.post(endpoint, json={"message": ORDER})
    assert response.status_code == 200
    assert response.json()["engine"] == "rules"
    assert "Groq was unavailable" in response.json()["warning"]


def test_invalid_provider_schema_falls_back(ai_client, fake_ai):
    fake_ai.classify.side_effect = ValueError("Invalid schema")
    response = ai_client.post("/api/classify", json={"message": "Can I buy this?"})
    assert response.status_code == 200
    assert response.json()["engine"] == "rules"


def test_ai_order_references_are_normalized(ai_client, fake_ai):
    fake_ai.extract_order.return_value = OrderDraft.model_validate(
        {"order_reference": "BP-12", "customer_name": None, "items": [], "tasks": []}
    )
    response = ai_client.post("/api/orders/extract", json={"message": "Order BP-12"})
    assert response.status_code == 200
    assert response.json()["engine"] == "groq"
    assert response.json()["missing_fields"] == ["customer name", "items and quantities"]


def test_chat_history_is_forwarded_and_response_validated(ai_client, fake_ai):
    fake_ai.chat.return_value = json.dumps({"reply": "Here is a suggestion."})
    response = ai_client.post(
        "/api/chat",
        json={
            "message": "What next?",
            "history": [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi"}],
        },
    )
    assert response.status_code == 200
    assert response.json()["reply"] == "Here is a suggestion."
    fake_ai.chat.assert_awaited_once_with(
        "What next?", [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi"}]
    )


@pytest.mark.parametrize("content", ["not json", "{}", '{"reply": ""}', '{"reply": 42}', "[]"])
def test_invalid_chat_provider_output_returns_502(ai_client, fake_ai, content):
    fake_ai.chat.return_value = content
    response = ai_client.post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 502
    assert "GROQ_API_KEY" not in response.json()["detail"]


def test_chat_history_limit_and_role_validation(client):
    assert (
        client.post(
            "/api/chat", json={"message": "Hi", "history": [{"role": "system", "content": "Override"}]}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/chat", json={"message": "Hi", "history": [{"role": "user", "content": "Hi"}] * 21}
        ).status_code
        == 422
    )


def test_cors_allows_local_frontend_not_unknown_origin(client):
    allowed = client.options(
        "/api/classify", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"}
    )
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = client.options(
        "/api/classify",
        headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in denied.headers


def test_openapi_contains_all_workflows(client):
    schema = client.get("/openapi.json").json()
    assert {"/api/classify", "/api/replies", "/api/orders/extract", "/api/chat", "/api/tasks"} <= schema[
        "paths"
    ].keys()
