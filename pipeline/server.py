"""
Railway용 FastAPI 서버.
파이프라인을 백그라운드 스레드로 실행하여
브라우저가 탭을 이동해도 계속 돌아감.
"""
from __future__ import annotations
import json
import os
import subprocess
import sys
import threading
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI()

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

API_SECRET = os.getenv("API_SECRET", "")

# 실행 중인 Job 저장소 (job_id → {logs, done, code})
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


class RunRequest(BaseModel):
    source: str = "melon"
    pages: int = 1


def _check_auth(request: Request) -> None:
    if not API_SECRET:
        return
    token = request.headers.get("x-api-key", "")
    if token != API_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _run_job(job_id: str, source: str, pages: int) -> None:
    """백그라운드 스레드에서 파이프라인 실행 — 브라우저 연결과 무관."""
    pipeline_dir = Path(__file__).parent
    args = [sys.executable, "pipeline.py", "--source", source, "--pages", str(pages)]
    proc = subprocess.Popen(
        args,
        cwd=str(pipeline_dir),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
        text=True,
        bufsize=1,
    )
    with _jobs_lock:
        _jobs[job_id]["proc"] = proc

    try:
        for line in proc.stdout:
            line = line.rstrip("\n")
            if line:
                with _jobs_lock:
                    _jobs[job_id]["logs"].append(line)
        proc.wait()
    finally:
        with _jobs_lock:
            _jobs[job_id]["done"] = True
            _jobs[job_id]["code"] = proc.returncode


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/run")
async def run_pipeline(body: RunRequest, request: Request):
    _check_auth(request)

    source = body.source if body.source in ("melon", "genie") else "melon"
    pages = max(1, min(5, body.pages))

    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {"logs": [], "done": False, "code": None, "proc": None}

    thread = threading.Thread(target=_run_job, args=(job_id, source, pages), daemon=True)
    thread.start()

    import asyncio

    async def generate():
        idx = 0
        while True:
            with _jobs_lock:
                logs = _jobs[job_id]["logs"]
                done = _jobs[job_id]["done"]
                code = _jobs[job_id]["code"]

            while idx < len(logs):
                yield f"data: {json.dumps({'log': logs[idx]})}\n\n"
                idx += 1

            if done and idx >= len(logs):
                yield f"data: {json.dumps({'done': True, 'code': code})}\n\n"
                break

            await asyncio.sleep(0.3)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
