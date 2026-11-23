"""
endpoints.py
Rotas da API v1: segmentação de imagem e consulta de capacidades do servidor.
"""

import base64
import logging
from typing import Optional

import cv2
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from src.services.segmentation_service import GPU_AVAILABLE, SegmentationService

logger = logging.getLogger(__name__)

router = APIRouter()


def _png_data_url(mask) -> str:
    """Codifica a máscara em PNG e devolve como data url (base64)."""
    _, buffer = cv2.imencode(".png", mask)
    return "data:image/png;base64," + base64.b64encode(buffer).decode("utf-8")


# Informa se o servidor tem GPU utilizável (o frontend pode desabilitar a opção GPU)
@router.get("/capabilities")
async def capabilities():
    return {"gpu": GPU_AVAILABLE}


# Recebe a imagem e devolve as máscaras (data url em base64), métricas e o motor usado
@router.post("/segment")
async def segment_image(
    file: UploadFile = File(...),
    threshold: int = Form(120),
    engine: str = Form("gpu"),
    auto_threshold: bool = Form(False),
    fill_holes: bool = Form(True),
    # máscara de referência opcional (PNG), para calcular Dice e IoU
    ground_truth: Optional[UploadFile] = File(None),
):
    try:
        image_bytes = await file.read()
        gt_bytes = await ground_truth.read() if ground_truth is not None else None

        # processamento síncrono (CPU/GPU) roda em thread para não travar o servidor
        result = await run_in_threadpool(
            SegmentationService.process,
            image_bytes,
            threshold,
            engine,
            auto_threshold,
            fill_holes,
            gt_bytes,
        )

        return {
            "success": True,
            # motor que realmente processou (pode ser "cpu" mesmo se pediu "gpu")
            "engine": result["engine"],
            # limiar efetivamente usado (o calculado por Otsu, se automático)
            "threshold": result["threshold"],
            "width": result["width"],
            "height": result["height"],
            "metrics": result["metrics"],
            "mask_url": _png_data_url(result["mask"]),
            "right_mask_url": _png_data_url(result["right_mask"]),
            "left_mask_url": _png_data_url(result["left_mask"]),
            "warnings": result["warnings"],
        }
    except ValueError as e:
        # imagem ou parâmetro inválido: erro do cliente
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # qualquer outra falha: erro do servidor, com stack trace no log
        logger.exception("Erro ao segmentar a imagem")
        raise HTTPException(status_code=500, detail=str(e))
