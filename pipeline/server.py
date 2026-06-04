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
_latest_job_id: str | None = None  # 가장 최근 시작된 job (재접속 대상 판단용)


class RunRequest(BaseModel):
    source: str = "melon"
    pages: int = 1
    limit: int | None = None  # 처리할 최대 아티스트 수 (테스트용)


def _check_auth(request: Request) -> None:
    if not API_SECRET:
        return
    token = request.headers.get("x-api-key", "")
    if token != API_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _run_job(job_id: str, source: str, pages: int, limit: int | None = None) -> None:
    """백그라운드 스레드에서 파이프라인 실행 — 브라우저 연결과 무관."""
    pipeline_dir = Path(__file__).parent
    args = [sys.executable, "pipeline.py", "--source", source, "--pages", str(pages)]
    if limit:
        args += ["--limit", str(limit)]
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


def _stream_job(job_id: str) -> StreamingResponse:
    """job_id 의 로그를 처음(offset 0)부터 재생 후 완료까지 tail.
    /run(새 실행)과 /logs/{job_id}(재접속) 모두 이 스트림을 공유 →
    브라우저가 탭/페이지를 이동해도 같은 작업에 다시 붙을 수 있다."""
    import asyncio

    async def generate():
        # 첫 이벤트로 job_id 를 알려줌 → 클라이언트가 저장해 두고 재접속에 사용
        yield f"data: {json.dumps({'job_id': job_id})}\n\n"
        idx = 0
        while True:
            with _jobs_lock:
                job = _jobs.get(job_id)
                if job is None:
                    yield f"data: {json.dumps({'done': True, 'code': -1, 'error': 'unknown job'})}\n\n"
                    return
                logs = job["logs"]
                done = job["done"]
                code = job["code"]

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


@app.post("/run")
async def run_pipeline(body: RunRequest, request: Request):
    _check_auth(request)

    source = body.source if body.source in ("melon", "genie", "genie_genre") else "melon"
    pages = max(1, min(5, body.pages))
    limit = body.limit if body.limit and body.limit > 0 else None

    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {"logs": [], "done": False, "code": None, "proc": None}
        global _latest_job_id
        _latest_job_id = job_id

    thread = threading.Thread(target=_run_job, args=(job_id, source, pages, limit), daemon=True)
    thread.start()

    return _stream_job(job_id)


@app.get("/logs/{job_id}")
def reconnect_logs(job_id: str):
    """진행 중(또는 완료된) 작업에 재접속 — 새로고침/페이지이동 후 진행상황 복구."""
    with _jobs_lock:
        exists = job_id in _jobs
    if not exists:
        raise HTTPException(status_code=404, detail="job not found")
    return _stream_job(job_id)


@app.get("/current")
def current_job():
    """현재 실행 중인(또는 가장 최근) 작업 정보 — 클라이언트가 재접속 대상 판단용."""
    with _jobs_lock:
        jid = _latest_job_id
        job = _jobs.get(jid) if jid else None
        running = bool(job and not job["done"])
    return {"job_id": jid if job else None, "running": running}
