import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import predict, auth, reports
from app.models.model_loader import load_models

# Configure logging so inference prints are visible
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

app = FastAPI(title="ONCOSIGHT AI Backend", version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    print("=" * 60)
    print("  ONCOSIGHT AI Backend — starting up")
    print("=" * 60)
    load_models()
    print("=" * 60)

app.include_router(auth.router)
app.include_router(predict.router)
app.include_router(reports.router)

@app.get("/")
def read_root():
    return {"message": "ONCOSIGHT AI Backend v2.0 running."}
