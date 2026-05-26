from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from app.services.inference_service import run_inference

router = APIRouter()

@router.post("/predict")
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
