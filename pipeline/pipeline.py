from __future__ import annotations
import argparse
import logging
import sys
from pathlib import Path
from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
if _ENV_PATH.is_file():
    load_dotenv(dotenv_path=str(_ENV_PATH))
elif _ENV_PATH.exists():
    raise RuntimeError(
        f".env 가 파일이 아님 (디렉토리 또는 비정상 상태): {_ENV_PATH}\n"
        f"호스트의 ~/Desktop/marketing-pipeline/.env 가 폴더로 만들어진 경우. "
        f"`rmdir`로 폴더 지우고 파일로 다시 만들어야 합니다."
    )
else:
    raise RuntimeError(
        f".env 파일 없음: {_ENV_PATH}\n"
        f"docker run 시 -v $(pwd)/.env:/app/.env 마운트를 확인하세요."
    )

import melon_crawler
import genie_crawler
from finder import find_instagram
from db import get_existing_artist_ids, upsert_artist, upsert_song, update_last_crawled

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[
        logging.FileHandler("pipeline.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("pipeline")


def _crawl(source: str, max_pages: int = 1) -> list[dict]:
    if source == "genie":
        return genie_crawler.crawl_new_songs(max_pages=max_pages)
    return melon_crawler.crawl_new_songs()


def _get_existing_ids(source: str) -> set[str]:
    return get_existing_artist_ids(source=source)


def _song_artist_id(artist: dict, source: str, artist_id: str | None) -> str:
    """songs 테이블의 melon_artist_id FK에 쓸 합성키 반환"""
    return artist.get("melon_artist_id") or (
        f"genie_{artist_id}" if source == "genie" and artist_id else artist_id or ""
    )


def main(source: str = "melon", limit: int | None = None, max_pages: int = 1):
    logger.info("=== 파이프라인 시작 [%s] ===", source)

    songs = _crawl(source, max_pages=max_pages)
    if not songs:
        logger.warning("수집된 신곡 없음. 종료.")
        return

    existing_ids = _get_existing_ids(source)
    id_key = "genie_artist_id" if source == "genie" else "melon_artist_id"

    # 신규 아티스트만 인스타 탐색 대상으로 분리 (limit 적용)
    new_artist_songs = [s for s in songs if s.get(id_key) not in existing_ids]
    if limit:
        new_artist_songs = new_artist_songs[:limit]

    logger.info(
        "수집: %d곡 | 신규 가수: %d명 | 기존 가수 신곡: %d곡",
        len(songs),
        len(new_artist_songs),
        len(songs) - len(new_artist_songs),
    )

    stats = {"new": 0, "insta_found": 0, "needs_review": 0, "songs_added": 0}

    # ── 신규 아티스트: 인스타 탐색 + 아티스트·곡 upsert ──
    for artist in new_artist_songs:
        artist_id = artist.get(id_key)
        name = artist["name"]

        try:
            if source == "genie" and artist_id:
                detail = genie_crawler.fetch_artist_detail(artist_id)
                artist.update(detail)

            if source == "melon" and artist_id:
                fan_count = melon_crawler.fetch_fan_count(artist_id)
                if fan_count is not None and fan_count >= 10000:
                    logger.info("[%s] 팬 수 %d명 — 스킵", name, fan_count)
                    continue
                detail = melon_crawler.fetch_artist_detail(artist_id)
                artist.update(detail)

            stats["new"] += 1

            handle, insta_source, score, email, not_found_reason = find_instagram(artist)
            needs_review = handle is None

            upsert_artist({
                "melon_artist_id": artist.get("melon_artist_id"),
                "genie_artist_id": artist.get("genie_artist_id"),
                "source": source,
                "name": name,
                "genre": artist.get("genre"),
                "agency": artist.get("agency"),
                "instagram_handle": handle,
                "instagram_url": f"https://www.instagram.com/{handle}/" if handle else None,
                "instagram_source": insta_source if handle else None,
                "confidence_score": score if score else None,
                "needs_review": needs_review,
                "email": email,
                "not_found_reason": not_found_reason,
            })

            song_artist_id = _song_artist_id(artist, source, artist_id)
            song_id = artist.get("genie_song_id") or artist.get("melon_song_id") or f"{song_artist_id}_{artist['title']}"
            upsert_song({
                "melon_song_id": song_id,
                "melon_artist_id": song_artist_id,
                "title": artist["title"],
                "album": artist.get("album"),
                "release_date": artist.get("release_date"),
            })
            stats["songs_added"] += 1

            if handle:
                stats["insta_found"] += 1
            if needs_review:
                stats["needs_review"] += 1
            logger.info("[%s] 완료 — 인스타: %s, 출처: %s, 점수: %s",
                name, handle or "없음", insta_source, score or "—")

        except Exception as e:
            logger.error("[%s] 처리 중 오류: %s", name, e, exc_info=True)
            continue

    # ── 기존 아티스트: last_crawled 업데이트 + 신규 곡만 upsert ──
    for song in songs:
        artist_id = song.get(id_key)
        if artist_id not in existing_ids:
            continue
        try:
            db_artist_id = _song_artist_id(song, source, artist_id)
            update_last_crawled(db_artist_id)
            song_id = song.get("genie_song_id") or song.get("melon_song_id") or f"{db_artist_id}_{song['title']}"
            upsert_song({
                "melon_song_id": song_id,
                "melon_artist_id": db_artist_id,
                "title": song["title"],
                "album": song.get("album"),
                "release_date": song.get("release_date"),
            })
            stats["songs_added"] += 1
            logger.info("[%s] 기존 가수 신곡 저장: %s", song["name"], song["title"])
        except Exception as e:
            logger.error("[%s] 곡 저장 오류: %s", song.get("name"), e)

    insta_rate = round(stats["insta_found"] / stats["new"] * 100) if stats["new"] else 0
    logger.info(
        "=== 완료 === 신규 가수: %d명 | 인스타 확보: %d명(%d%%) | 검토 필요: %d명 | 곡 저장: %d곡",
        stats["new"], stats["insta_found"], insta_rate, stats["needs_review"], stats["songs_added"],
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=["melon", "genie"], default="melon", help="크롤링 소스")
    parser.add_argument("--limit", type=int, default=None, help="처리할 최대 아티스트 수")
    parser.add_argument("--pages", type=int, default=1, help="크롤링할 최대 페이지 수 (지니 전용)")
    args = parser.parse_args()
    main(source=args.source, limit=args.limit, max_pages=args.pages)
