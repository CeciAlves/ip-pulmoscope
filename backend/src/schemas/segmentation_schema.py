from typing import List, Optional

from pydantic import BaseModel

class SegmentationMetrics(BaseModel):
    rightArea: int
    leftArea: int
    totalArea: int
    totalTime: float
    kernelTime: float
    transferTime: float
    dice: Optional[float] = None
    iou: Optional[float] = None

class SegmentationResponse(BaseModel):
    success: bool
    engine: str
    threshold: int
    width: int
    height: int
    metrics: SegmentationMetrics
    mask_url: str
    right_mask_url: str
    left_mask_url: str
    warnings: List[str]
