"""FastAPI推論サーバー"""

import argparse
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

from inference import CenterLineInference

app = FastAPI(title="Center Line Detection API")

# Global inference instance
inference: Optional[CenterLineInference] = None


class PredictRequest(BaseModel):
    image_base64: Optional[str] = None
    image_path: Optional[str] = None


class PredictResponse(BaseModel):
    has_center_line: bool
    probability: float
    confidence: float


class BatchPredictRequest(BaseModel):
    images: list[str]  # Base64 or paths


class BatchPredictResponse(BaseModel):
    results: list[PredictResponse]


@app.on_event("startup")
async def startup():
    """サーバー起動時にモデルをロード"""
    global inference
    print("Loading model...")
    inference = CenterLineInference()
    print("Model loaded and ready!")


@app.get("/health")
async def health():
    """ヘルスチェック"""
    return {"status": "ok", "model_loaded": inference is not None}


@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """単一画像の推論"""
    if inference is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if request.image_base64:
        result = inference.predict_from_base64(request.image_base64)
    elif request.image_path:
        result = inference.predict_from_path(request.image_path)
    else:
        raise HTTPException(status_code=400, detail="Either image_base64 or image_path is required")

    return PredictResponse(**result)


@app.post("/predict_batch", response_model=BatchPredictResponse)
async def predict_batch(request: BatchPredictRequest):
    """バッチ推論"""
    if inference is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not request.images:
        raise HTTPException(status_code=400, detail="images list is empty")

    results = inference.predict_batch(request.images)
    return BatchPredictResponse(results=[PredictResponse(**r) for r in results])


def main():
    parser = argparse.ArgumentParser(description="Start the inference server")
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    uvicorn.run(
        "server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
