"""
파이프라인 이벤트 emit 헬퍼.

대시보드 UI가 진행 상황을 카드/프로그레스로 시각화할 수 있도록
구조화된 JSON 이벤트를 stdout으로 송출한다.

기존 logger.info() 텍스트 로그는 그대로 유지 (`pipeline.log` 파일·고급로그 패널용).
이건 추가 채널일 뿐.

이벤트 형식:
    EVENT:{"type":"stage","stage":"collecting","status":"start",...}
"""
from __future__ import annotations
import json
import sys


def emit(event: dict) -> None:
    """이벤트를 stdout에 EVENT: 프리픽스로 출력."""
    print(f"EVENT:{json.dumps(event, ensure_ascii=False)}", flush=True)


def stage_start(stage: str, **kwargs) -> None:
    emit({"type": "stage", "stage": stage, "status": "start", **kwargs})


def stage_progress(stage: str, **kwargs) -> None:
    emit({"type": "stage", "stage": stage, "status": "progress", **kwargs})


def stage_complete(stage: str, **kwargs) -> None:
    emit({"type": "stage", "stage": stage, "status": "complete", **kwargs})


def artist_processing(name: str, index: int, total: int) -> None:
    emit({"type": "artist", "status": "processing", "name": name, "index": index, "total": total})


def artist_done(
    name: str,
    handle: str | None,
    score: int | None,
    source: str | None,
    index: int,
    total: int,
    needs_review: bool = False,
    reason: str | None = None,
) -> None:
    emit({
        "type": "artist",
        "status": "review" if needs_review else "done",
        "name": name,
        "handle": handle,
        "score": score,
        "source": source,
        "reason": reason,
        "index": index,
        "total": total,
    })


def artist_skip(name: str, reason: str, index: int, total: int) -> None:
    emit({
        "type": "artist",
        "status": "skip",
        "name": name,
        "reason": reason,
        "index": index,
        "total": total,
    })


def pipeline_done(stats: dict, duration_sec: float) -> None:
    emit({
        "type": "pipeline",
        "status": "complete",
        "stats": stats,
        "duration_sec": round(duration_sec, 1),
    })


def pipeline_error(message: str) -> None:
    emit({"type": "pipeline", "status": "error", "message": message})
