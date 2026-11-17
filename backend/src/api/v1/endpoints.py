"""
endpoints.py
Rotas da API v1: segmentação de imagem e consulta de capacidades do servidor.
"""

import base64
import logging

import cv2
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from src.services.segmentation_service import GPU_AVAILABLE, SegmentationService

logger = logging.getLogger(__name__)

router = APIRouter()


# Informa se o servidor tem GPU utilizável (o frontend pode desabilitar a opção GPU)
@router.get("/capabilities")
async def capabilities():
    return {"gpu": GPU_AVAILABLE}


# Recebe a imagem e devolve máscara (data url em base64), métricas e o motor usado
@router.post("/segment")
async def segment_image(
    file: UploadFile = File(...),
    threshold: int = Form(120),
    engine: str = Form("gpu"),
):
    try:
        image_bytes = await file.read()

        metrics, mask, engine_used = SegmentationService.process(
            image_bytes, threshold, engine
        )

        # Codifica a máscara em PNG e embute na resposta como data url
        _, buffer = cv2.imencode(".png", mask)
        mask_base64 = base64.b64encode(buffer).decode("utf-8")
        mask_url = f"data:image/png;base64,{mask_base64}"

        return {
            "success": True,
            # motor que realmente processou (pode ser "cpu" mesmo se pediu "gpu")
            "engine": engine_used,
            "metrics": metrics,
            "mask_url": mask_url,
        }
    except ValueError as e:
        # imagem inválida: erro do cliente
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # qualquer outra falha: erro do servidor, com stack trace no log
        logger.exception("Erro ao segmentar a imagem")
        raise HTTPException(status_code=500, detail=str(e))