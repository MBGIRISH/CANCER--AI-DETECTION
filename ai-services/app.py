import logging
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from model_loader import load_models
from inference_service import run_inference

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("ai_inference_service")

app = FastAPI(title="SynaptoMed AI Inference Service", version="2.0.0")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    logger.info("Initializing SynaptoMed AI Inference Service...")
    load_models()
    logger.info("Inference models loaded successfully.")

@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    category: str = Form(...)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File provided is not an image.")

    try:
        image_data = await file.read()
        result = run_inference(image_data, category)
        return result
    except Exception as e:
        logger.error(f"Inference execution error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    from model_loader import is_fallback_mode
    return {
        "status": "healthy",
        "fallback_mode": is_fallback_mode()
    }
