from __future__ import annotations
import argparse
import logging
import sys
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env")

from crawler import crawl_new_songs, fetch_artist_detail, fetch_fan_count
from finder import find_instagram
from db import get_existing_artist_ids, upsert_artist, upsert_song

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[
        logging.FileHandler("pipeline.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("pipeline")

# 대형 기획사 차단 목록 — 인지도 높은 가수는 홍보 타겟 아님
BLOCKED_AGENCIES = {
    "sm엔터테인먼트", "sm entertainment",
    "yg엔터테인먼트", "yg entertainment",
    "jyp엔터테인먼트", "jyp entertainment",
    "빅히트뮤직", "big hit music", "hybe", "하이브",
    "어도어", "ador",
    "플레디스엔터테인먼트", "pledis entertainment",
    "쏘스뮤직", "source music",
    "빌리프랩", "belift lab",
    "케이오지엔터테인먼트", "koz entertainment",
    "스타쉽엔터테인먼트", "starship entertainment",
    "큐브엔터테인먼트", "cube entertainment",
    "fnc엔터테인먼트", "fnc entertainment",
    "울림엔터테인먼트", "woollim entertainment",
    "카카오엔터테인먼트", "kakao entertainment",
    "넥스트레벨스튜디오", "next level studio",
    "웨이크원", "wake one",
}

def _is_blocked(agency: str | None) -> bool:
    if not agency:
        return False
    return agency.strip().lower() in BLOCKED_AGENCIES


def main(melon_only: bool = False):
    mode = "멜론 수집 전용" if melon_only else "전체"
    logger.info("=== 파이프라인 시작 [%s 모드] ===", mode)

    songs = crawl_new_songs()
    if not songs:
        logger.warning("수집된 신곡 없음. 종료.")
        return

    existing_ids = get_existing_artist_ids()
    new_artists = [s for s in songs if s["melon_artist_id"] not in existing_ids]
    logger.info("신규 가수: %d명 (전체 수집: %d곡)", len(new_artists), len(songs))

    stats = {"new": len(new_artists), "insta_found": 0, "needs_review": 0}

    for artist in new_artists:
        artist_id = artist["melon_artist_id"]
        name = artist["name"]

        try:
            # 멜론 아티스트 상세 (장르·소속사)
            detail = fetch_artist_detail(artist_id)
            artist.update(detail)

            # 대형 기획사 차단
            if _is_blocked(artist.get("agency")):
                logger.info("[%s] 대형 기획사(%s) — 스킵", name, artist.get("agency"))
                stats["new"] -= 1
                continue

            # 팬 수 1만 이상 스킵 (MELON_COOKIE 있을 때만 동작)
            fan_count = fetch_fan_count(artist_id)
            if fan_count is not None and fan_count >= 10000:
                logger.info("[%s] 팬 수 %d명 — 스킵", name, fan_count)
                stats["new"] -= 1
                continue

            if melon_only:
                # 인스타 탐색 생략 — 검토필요로 저장
                handle, source, score, email = None, None, 0, None
                needs_review = True
                logger.info("[%s] 멜론 수집 완료 (인스타 탐색 생략)", name)
            else:
                handle, source, score, email = find_instagram(artist)
                needs_review = score < 70 or handle is None
                logger.info(
                    "[%s] 완료 — 인스타: %s, 출처: %s, 점수: %d, 검토필요: %s",
                    name, handle or "없음", source, score, needs_review,
                )

            upsert_artist({
                "melon_artist_id": artist_id,
                "name": name,
                "genre": artist.get("genre"),
                "agency": artist.get("agency"),
                "instagram_handle": handle,
                "instagram_url": f"https://www.instagram.com/{handle}/" if handle else None,
                "instagram_source": source if handle else None,
                "confidence_score": score if score else None,
                "needs_review": needs_review,
                "email": email,
            })

            upsert_song({
                "melon_song_id": artist.get("melon_song_id") or f"{artist_id}_{artist['title']}",
                "melon_artist_id": artist_id,
                "title": artist["title"],
                "album": artist.get("album"),
                "release_date": artist.get("release_date"),
            })

            if handle:
                stats["insta_found"] += 1
            if needs_review:
                stats["needs_review"] += 1

        except Exception as e:
            logger.error("[%s] 처리 중 오류: %s", name, e, exc_info=True)
            continue

    insta_rate = round(stats["insta_found"] / stats["new"] * 100) if stats["new"] else 0
    logger.info(
        "=== 파이프라인 완료 === 신규: %d명 | 인스타 확보: %d명(%d%%) | 검토 필요: %d명",
        stats["new"], stats["insta_found"], insta_rate, stats["needs_review"],
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--melon-only", action="store_true", help="멜론 수집만 실행 (인스타 탐색 생략)")
    args = parser.parse_args()
    main(melon_only=args.melon_only)
