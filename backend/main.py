
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="BizPilot AI API")

# Allow our React frontend to communicate with this backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "BizPilot AI backend is running!"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "project": "BizPilot AI"
    }
