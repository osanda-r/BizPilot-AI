"""Transparent, offline English-language helpers. These are not an AI model."""

import re

from .models import (
    Classification,
    OrderExtraction,
    OrderItem,
    ReplyResult,
    TaskCreate,
    Tone,
)

CUSTOMER_SERVICE_WARNING = (
    "Generated with local English-language rules, not AI. Review the result before using it."
)
PROVIDER_WARNING = "Groq was unavailable. This result uses local English-language rules; please review it."


def classify_message(message: str) -> Classification:
    text = message.lower()
    if re.search(r"\b(refund|money back|return my payment|chargeback)\b", text):
        category = "refund"
    elif re.search(
        r"\b(complaint|damaged|broken|defective|late|delayed|missing|wrong|unhappy|terrible)\b", text
    ):
        category = "complaint"
    elif re.search(r"\b(order|purchase|buy|ordered|ordering)\b", text):
        category = "order"
    elif re.search(r"\b(thank|thanks|great|excellent|love|feedback|suggestion)\b", text):
        category = "feedback"
    elif "?" in text or re.search(
        r"\b(price|cost|available|stock|hours|delivery|shipping|how|what|when|where)\b", text
    ):
        category = "inquiry"
    else:
        category = "other"

    urgent = bool(re.search(r"\b(urgent|urgently|asap|immediately|emergency|legal action|fraud)\b", text))
    negative = category in {"complaint", "refund"} or bool(
        re.search(r"\b(angry|disappointed|upset|unacceptable|worst)\b", text)
    )
    actions = {
        "order": "Confirm the requested items, quantities, customer details, and availability before accepting the order.",
        "complaint": "Review the issue with the customer and agree on an appropriate next step.",
        "refund": "Check the order and applicable refund policy before deciding on a refund.",
        "inquiry": "Answer the customer's question using verified business information.",
        "feedback": "Acknowledge the feedback and share relevant suggestions with your team.",
        "other": "Review the message and decide whether a personal response is needed.",
    }
    first_sentence = re.split(r"(?<=[.!?])\s+|\n", message.strip(), maxsplit=1)[0]
    summary = first_sentence if len(first_sentence) <= 240 else first_sentence[:237].rstrip() + "…"
    return Classification(
        category=category,
        priority="urgent" if urgent else "high" if negative else "normal",
        sentiment="negative" if negative else "positive" if category == "feedback" else "neutral",
        summary=summary,
        suggested_action=actions[category],
    )


def draft_reply(message: str, tone: Tone, business_name: str = "") -> ReplyResult:
    classification = classify_message(message)
    openings = {
        "order": "Thank you for your order request. We have received the details in your message.",
        "complaint": "Thank you for bringing this to our attention. I'm sorry to hear about the difficulty you've experienced.",
        "refund": "Thank you for contacting us about your refund request. We understand that you would like this reviewed.",
        "inquiry": "Thank you for getting in touch. We appreciate your interest and would be happy to help with your question.",
        "feedback": "Thank you for taking the time to share your feedback. We appreciate you letting us know.",
        "other": "Thank you for your message. We appreciate you getting in touch.",
    }
    next_steps = {
        "order": "To help us review your request, please confirm the item names, quantities, and your preferred contact details if you have not already provided them. We will confirm availability and the total before the order is finalized.",
        "complaint": "Please share any relevant order reference and details of the issue so we can review it. We will follow up with an appropriate next step after checking the information.",
        "refund": "Please provide the order reference and reason for the request if you have not already done so. We can then review it against the applicable refund policy; a refund is not confirmed by this message.",
        "inquiry": "We need to check the relevant details before giving you a confirmed answer. Please share any specific requirements so we can direct your question to the right person.",
        "feedback": "Your comments help us understand what matters to our customers. We would welcome any additional details you would like us to consider.",
        "other": "Could you let us know how you would like us to help? We will review your message and respond with the relevant information.",
    }
    if tone == "concise":
        body = openings[classification.category]
    elif tone == "friendly":
        body = f"Thanks for reaching out! {next_steps[classification.category]}"
    else:
        body = f"{openings[classification.category]}\n\n{next_steps[classification.category]}"
    signature = business_name.strip() or "Customer Support"
    return ReplyResult(
        draft=f"Hello,\n\n{body}\n\nBest regards,\n{signature}",
        category=classification.category,
        engine="rules",
        warning=CUSTOMER_SERVICE_WARNING,
    )


ORDER_REFERENCE = re.compile(
    r"(?:\border\s*(?:(?:reference|ref|number|no\.?|id)\s*[:#]?\s*|[:#]\s*|(?=[A-Z0-9_-]*\d))|#)"
    r"([A-Z0-9][A-Z0-9_-]{1,39})\b",
    re.IGNORECASE,
)
CUSTOMER_NAME = re.compile(r"\b(?:customer|customer name|name)\s*:\s*([^\n,;]+)", re.IGNORECASE)
ITEM_LINE = re.compile(r"^\s*(?:[-*•]\s*)?(\d{1,5})\s*(?:x\s+|\s)[ \t]*(.+?)\s*$", re.IGNORECASE)
INLINE_ITEM = re.compile(
    r"\b(\d{1,5})\s+(?:x\s+)?([A-Za-z][A-Za-z0-9 '&\"()/_-]{0,150}?)"
    r"(?=\s*(?:[,;\n]|\band\b|\bplus\b|\bfor\b|\bplease\b|\bdeliver\b|\bship\b|[.!]|$))",
    re.IGNORECASE,
)


def extract_order(message: str) -> OrderExtraction:
    """Extract only explicit references, labelled names, and simple quantity/item pairs.

    Unstructured or non-English orders should use Groq or be entered manually. Unknown
    fields stay unknown; the original message is retained in the review task.
    """
    reference_match = ORDER_REFERENCE.search(message)
    name_match = CUSTOMER_NAME.search(message)
    reference = reference_match.group(1) if reference_match else None
    customer_name = name_match.group(1).strip()[:200] if name_match else None
    pairs: list[tuple[str, str]] = []
    for line in message.splitlines():
        match = ITEM_LINE.match(line)
        if match:
            pairs.append((match.group(1), match.group(2)))
    if not pairs:
        pairs = [(match.group(1), match.group(2)) for match in INLINE_ITEM.finditer(message)]
    items: list[OrderItem] = []
    for quantity_text, raw_name in pairs[:50]:
        quantity = int(quantity_text)
        name = re.sub(r"\s+", " ", raw_name).strip(" .-")
        if not 1 <= quantity <= 10000 or not name or len(name) > 200:
            continue
        if re.search(r"\b(?:https?://|www\.)\S+", name, re.IGNORECASE):
            continue
        items.append(OrderItem(name=name, quantity=quantity))

    label = f"order {reference}" if reference else "the order request"
    tasks = [
        TaskCreate(
            title=f"Review and confirm {label}",
            description=(
                "Verify customer details, item quantities, pricing, availability, and delivery requirements. "
                "Do not treat the request as a confirmed order until reviewed.\n\n"
                f"Original message:\n{message}"
            ),
            priority="high" if re.search(r"\b(urgent|asap)\b", message, re.IGNORECASE) else "normal",
            order_reference=reference,
        )
    ]
    tasks.extend(
        TaskCreate(
            title=f"Prepare {item.quantity} × {item.name}"[:200],
            description=f"Check stock and prepare this requested item after confirming {label}.",
            order_reference=reference,
        )
        for item in items
    )
    missing_fields = []
    if not reference:
        missing_fields.append("order reference")
    if not customer_name:
        missing_fields.append("customer name")
    if not items:
        missing_fields.append("items and quantities")
    return OrderExtraction(
        order_reference=reference,
        customer_name=customer_name,
        items=items,
        tasks=tasks,
        missing_fields=missing_fields,
        engine="rules",
        warning=CUSTOMER_SERVICE_WARNING,
    )
