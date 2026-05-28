"""
Railway용 FastAPI 서버.
브라우저가 직접 이 서버에 SSE 연결해서 파이프라인 진행상황을 받음.
"""
from __future__ import annotations
import os
import subprocess
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI()

# CORS — Vercel 도메인 + 로컬 개발 모두 허용
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

API_SECRET = os.getenv("API_SECRET", "")


class RunRequest(BaseModel):
    source: str = "melon"
    pages: int = 1


def _check_auth(request: Request) -> None:
    if not API_SECRET:
        return
    token = request.headers.get("x-api-key", "")
    if token != API_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/run")
async def run_pipeline(body: RunRequest, request: Request):
    _check_auth(request)

    source = body.source if body.source in ("melon", "genie") else "melon"
    pages = max(1, min(5, body.pages))

    pipeline_dir = Path(__file__).parent
    args = [sys.executable, "pipeline.py", "--source", source, "--pages", str(pages)]

    async def generate():
        proc = subprocess.Popen(
            args,
            cwd=str(pipeline_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
            text=True,
            bufsize=1,
        )
        try:
            for line in proc.stdout:
                line = line.rstrip("\n")
                if line:
                    import json
                    yield f"data: {json.dumps({'log': line})}\n\n"
            proc.wait()
            import json
            yield f"data: {json.dumps({'done': True, 'code': proc.returncode})}\n\n"
        finally:
            if proc.poll() is None:
                proc.terminate()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
