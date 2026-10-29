
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

app = FastAPI(
    title="AI Business Agent API",
    version="1.0.0",
    description="API for an AI-powered business automation platform",
)

# Allow requests from the local React development server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "AI Business Agent API is running"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AI Business Agent API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/dashboard")
def get_dashboard():
    # Sample data for the first dashboard version.
    # We will replace this with database data later.
    return {
        "stats": {
            "total_tasks": 24,
            "completed_tasks": 16,
            "pending_tasks": 8,
            "messages_processed": 128,
        },
        "tasks": [
            {
                "id": 1,
                "title": "Review new customer inquiry",
                "category": "Customer Support",
                "status": "Pending",
                "priority": "High",
            },
            {
                "id": 2,
                "title": "Prepare appointment summary",
                "category": "Appointments",
                "status": "In Progress",
                "priority": "Medium",
            },
            {
                "id": 3,
                "title": "Organize order information",
                "category": "Orders",
                "status": "Completed",
                "priority": "Low",
            },
            {
                "id": 4,
                "title": "Draft customer follow-up",
                "category": "Communication",
                "status": "Pending",
                "priority": "Medium",
            },
        ],
        "messages": [
            {
                "id": 1,
                "customer": "Amelia Perera",
                "subject": "Appointment booking",
                "time": "2 min ago",
                "status": "Needs review",
            },
            {
                "id": 2,
                "customer": "Daniel Silva",
                "subject": "Product inquiry",
                "time": "18 min ago",
                "status": "Draft ready",
            },
            {
                "id": 3,
                "customer": "Sarah Fernando",
                "subject": "Order information",
                "time": "35 min ago",
                "status": "Needs review",
            },
        ],
    }
