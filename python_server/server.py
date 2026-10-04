"""
server.py - Local low-latency FastAPI server for Laya.
"""

import os
import time
from typing import Any, Dict, List, Optional
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Tune CPU threads
torch.set_num_threads(min(8, os.cpu_count() or 4))

from laya import Router

app = FastAPI(
    title="Laya Local Decision API",
    description="Ultra-fast, non-autoregressive System 1 decision engine running locally.",
    version="1.0.0",
)

router: Optional[Router] = None


class PredictRequest(BaseModel):
    state: Any = Field(..., description="Text string, dict, or message object to evaluate")
    questions: Dict[str, Any] = Field(..., description="Dict of typed questions (choice, score, noul)")
    model: Optional[str] = Field(None, description="Optional checkpoint override ('english', 'multilingual', 'typed-decisions')")
    min_confidence: Optional[float] = Field(None, description="Abstention threshold (0.0 - 1.0)")


class BatchPredictRequest(BaseModel):
    states: List[Any] = Field(..., description="List of text items or states")
    questions: Dict[str, Any] = Field(..., description="Dict of typed questions")
    batch_size: Optional[int] = Field(8, description="Number of items per forward pass")
    sort_by_length: Optional[bool] = Field(True, description="Group similar length texts to minimize padding compute")


@app.on_event("startup")
def startup_event():
    global router
    print("Pre-loading Laya router...")
    # Preload to eliminate cold-start latency for API calls
    router = Router(preload=False, max_loaded=2)
    # Warmup with small request
    dummy_q = {"test": {"type": "noul", "instructions": "Is this a test?"}}
    _ = router.predict("system warm-up check", dummy_q)
    print("Laya engine warmed up and ready for inference!")


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "device": "cpu",
        "threads": torch.get_num_threads(),
        "ready": router is not None,
    }


@app.post("/predict")
def predict(req: PredictRequest):
    if router is None:
        raise HTTPException(status_code=503, detail="Model is still initializing")

    t0 = time.perf_counter()
    kwargs = {}
    if req.model:
        kwargs["model"] = req.model
    if req.min_confidence is not None:
        kwargs["min_confidence"] = req.min_confidence

    result = router.predict(req.state, req.questions, **kwargs)
    latency_ms = (time.perf_counter() - t0) * 1000.0

    return {
        "result": result,
        "latency_ms": round(latency_ms, 2),
    }


@app.post("/predict/batch")
def predict_batch(req: BatchPredictRequest):
    if router is None:
        raise HTTPException(status_code=503, detail="Model is still initializing")

    t0 = time.perf_counter()
    batch_requests = [{"state": s, "questions": req.questions} for s in req.states]
    results = router.predict_batch(
        batch_requests,
        batch_size=req.batch_size or 8,
        sort_by_length=req.sort_by_length if req.sort_by_length is not None else True,
    )
    total_latency_ms = (time.perf_counter() - t0) * 1000.0

    return {
        "count": len(req.states),
        "results": results,
        "total_latency_ms": round(total_latency_ms, 2),
        "per_item_ms": round(total_latency_ms / max(1, len(req.states)), 2),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False)
