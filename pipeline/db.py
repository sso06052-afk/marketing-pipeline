from __future__ import annotations
import os
import logging
from datetime import date
from supabase import create_client, Client

logger = logging.getLogger(__name__)

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL 또는 SUPABASE_KEY 환경변수 없음")
        _client = create_client(url, key)
    return _client


# ──────────────────────────────────────────────
# 아티스트
# ──────────────────────────────────────────────

def update_last_crawled(melon_artist_id: str) -> None:
    """기존 아티스트의 last_crawled만 오늘로 업데이트 (나머지 필드 건드리지 않음)"""
    client = get_client()
    client.table("artists").update({"last_crawled": date.today().isoformat()}).eq("melon_artist_id", melon_artist_id).execute()
    logger.debug("last_crawled 업데이트: %s", melon_artist_id)


def get_existing_artist_ids(source: str = "melon") -> set[str]:
    """DB에 이미 존재하는 아티스트 ID 집합 반환"""
    client = get_client()
    id_col = "genie_artist_id" if source == "genie" else "melon_artist_id"
    resp = client.table("artists").select(id_col).eq("source", source).execute()
    return {row[id_col] for row in resp.data if row.get(id_col)}


def upsert_artist(artist: dict) -> None:
    """
    artists 테이블 upsert.
    contacted=true인 가수는 DB 트리거가 연락 상태 필드를 보호.
    """
    client = get_client()

    # 지니 전용 아티스트는 melon_artist_id가 없으므로 합성 키 사용
    melon_id = artist.get("melon_artist_id") or (
        f"genie_{artist['genie_artist_id']}" if artist.get("genie_artist_id") else None
    )
    if not melon_id:
        raise ValueError(f"아티스트 ID 없음: {artist.get('name')}")

    payload = {
        "melon_artist_id": melon_id,
        "name": artist["name"],
        "genre": artist.get("genre"),
        "agency": artist.get("agency"),
        "instagram_handle": artist.get("instagram_handle"),
        "instagram_url": artist.get("instagram_url"),
        "instagram_source": artist.get("instagram_source"),
        "confidence_score": artist.get("confidence_score"),
        "needs_review": artist.get("needs_review", False),
        "email": artist.get("email"),
        "email_source": artist.get("email_source"),
        "not_found_reason": artist.get("not_found_reason"),
        "source": artist.get("source", "melon"),
        "genie_artist_id": artist.get("genie_artist_id"),
        "last_crawled": date.today().isoformat(),
    }

    client.table("artists").upsert(payload, on_conflict="melon_artist_id").execute()
    logger.debug("아티스트 upsert 완료: %s", artist["name"])


# ──────────────────────────────────────────────
# 곡
# ──────────────────────────────────────────────

def upsert_song(song: dict) -> None:
    client = get_client()
    payload = {
        "melon_song_id": song["melon_song_id"],
        "melon_artist_id": song["melon_artist_id"],
        "title": song["title"],
        "album": song.get("album"),
        "release_date": song.get("release_date"),
    }
    client.table("songs").upsert(payload, on_conflict="melon_song_id").execute()
    logger.debug("곡 upsert 완료: %s", song["title"])


# ──────────────────────────────────────────────
# Google CSE 사용량
# ──────────────────────────────────────────────

def _cse_key(day: str) -> str:
    return f"serper_usage_{day}"


def get_serper_usage(day: str | None = None) -> int:
    """오늘(또는 지정 날짜) Google CSE 사용 횟수 반환"""
    day = day or date.today().isoformat()
    client = get_client()
    resp = client.table("config").select("value").eq("key", _cse_key(day)).execute()
    if resp.data:
        return int(resp.data[0]["value"])
    return 0


def increment_serper_usage(day: str | None = None) -> int:
    """CSE 사용량 +1 후 현재 값 반환"""
    day = day or date.today().isoformat()
    current = get_serper_usage(day)
    new_val = current + 1
    client = get_client()
    client.table("config").upsert(
        {"key": _cse_key(day), "value": str(new_val)},
        on_conflict="key",
    ).execute()
    logger.debug("CSE 사용량: %d/100", new_val)
    return new_val
