from pydantic import BaseModel

class SegmentationMetrics(BaseModel):
    rightArea: int
    leftArea: int
    totalArea: int
    totalTime: float
    kernelTime: float
    transferTime: float

class SegmentationResponse(BaseModel):
    success: bool
    engine: str
    metrics: SegmentationMetrics
    mask_url: str 