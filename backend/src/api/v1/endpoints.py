from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from src.services.segmentation_service import SegmentationService
import cv2
import base64

router = APIRouter()

@router.post("/segment")
async def segment_image(
    file: UploadFile = File(...),
    threshold: int = Form(120),
    engine: str = Form("gpu")
):
    try:
        image_bytes = await file.read()
        
        metrics, mask = SegmentationService.process(image_bytes, threshold, engine)

        _, buffer = cv2.imencode('.png', mask)
        mask_base64 = base64.b64encode(buffer).decode('utf-8')
        mask_url = f"data:image/png;base64,{mask_base64}"

        return {
            "success": True,
            "engine": engine,
            "metrics": metrics,
            "mask_url": mask_url
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))