from __future__ import annotations
import time
import random
import logging
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

MELON_NEW_SONGS_URL = "https://www.melon.com/new/index.htm"
MELON_ARTIST_URL = "https://www.melon.com/artist/detail.htm?artistId={artist_id}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.melon.com",
    "Accept-Language": "ko-KR,ko;q=0.9",
}


def _get_with_retry(url: str, params: dict = None, max_retries: int = 3) -> requests.Response:
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, headers=HEADERS, params=params, timeout=10)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** attempt
            logger.warning("요청 실패 (시도 %d/%d): %s — %ds 후 재시도", attempt + 1, max_retries, e, wait)
            time.sleep(wait)


def crawl_new_songs() -> list[dict]:
    """
    멜론 신곡 페이지에서 곡·가수 정보를 수집.
    반환: [{melon_artist_id, name, title, album, release_date, genre, agency}, ...]
    """
    logger.info("멜론 신곡 페이지 크롤링 시작")
    resp = _get_with_retry(MELON_NEW_SONGS_URL)
    soup = BeautifulSoup(resp.text, "html.parser")

    results = []
    seen_artist_ids = set()

    rows = soup.select("table tbody tr")
    if not rows:
        # 동적 렌더링 fallback: div 기반 레이아웃
        rows = soup.select(".wrap_song_info")

    for row in rows:
        try:
            song_data = _parse_row(row)
            if not song_data:
                continue

            artist_id = song_data["melon_artist_id"]
            if artist_id and artist_id not in seen_artist_ids:
                seen_artist_ids.add(artist_id)
                results.append(song_data)
        except Exception as e:
            logger.warning("행 파싱 실패: %s", e)
            continue

        time.sleep(random.uniform(1, 2))

    logger.info("신곡 수집 완료: %d곡", len(results))
    return results


def _parse_row(row) -> dict | None:
    # 곡 ID (체크박스 value)
    song_id_el = row.select_one("input.input_check")
    melon_song_id = song_id_el.get("value") if song_id_el else None

    # 곡명
    title_el = row.select_one(".ellipsis.rank01 a")
    if not title_el:
        return None
    title = title_el.get_text(strip=True)

    # 가수명 + 아티스트 ID
    artist_el = row.select_one(".ellipsis.rank02 a:first-child")
    if not artist_el:
        return None
    name = artist_el.get_text(strip=True)
    artist_id = _extract_artist_id(artist_el.get("href", ""))

    # 앨범명
    album_el = row.select_one(".ellipsis.rank03 a")
    album = album_el.get_text(strip=True) if album_el else ""

    # 발매일: 신곡 페이지에 컬럼 없음 → None
    return {
        "melon_song_id": melon_song_id,
        "melon_artist_id": artist_id,
        "name": name,
        "title": title,
        "album": album,
        "release_date": None,
        "genre": None,
        "agency": None,
    }


def _extract_artist_id(href: str) -> str | None:
    """href 또는 onclick에서 artistId 추출"""
    import re
    # goArtistDetail('12345') 또는 artistId=12345 형식 모두 처리
    match = re.search(r"goArtistDetail\(['\"]?(\d+)", href) or re.search(r"artistId[=,](\d+)", href)
    return match.group(1) if match else None


def fetch_artist_detail(artist_id: str) -> dict:
    """
    멜론 아티스트 페이지에서 장르·소속사 + SNS 링크 수집.
    반환: {genre, agency, instagram_url}
    """
    import re
    time.sleep(random.uniform(1, 2))
    url = MELON_ARTIST_URL.format(artist_id=artist_id)
    try:
        resp = _get_with_retry(url)
    except Exception as e:
        logger.warning("아티스트 상세 페이지 실패 (ID: %s): %s", artist_id, e)
        return {"genre": None, "agency": None, "instagram_url": None}

    soup = BeautifulSoup(resp.text, "html.parser")

    # 장르: dt 텍스트가 '장르'인 다음 dd
    genre = None
    for dt in soup.find_all("dt"):
        if dt.get_text(strip=True) == "장르":
            dd = dt.find_next_sibling("dd")
            if dd:
                genre = dd.get_text(strip=True)
            break

    # 소속사: dt 텍스트가 '소속사'인 다음 dd
    agency = None
    for dt in soup.find_all("dt"):
        if "소속사" in dt.get_text(strip=True):
            dd = dt.find_next_sibling("dd")
            if dd:
                agency = dd.get_text(strip=True)
            break

    # SNS: onclick="window.open('https://instagram.com/...', '_blank')" 패턴
    instagram_url = None
    sns_section = soup.find("dl", id="artist_sns_list")
    if sns_section:
        for btn in sns_section.find_all("button", onclick=True):
            onclick = btn.get("onclick", "")
            m = re.search(r"window\.open\(['\"]([^'\"]*instagram\.com[^'\"]*)['\"]", onclick)
            if m:
                instagram_url = m.group(1)
                break

    return {"genre": genre, "agency": agency, "instagram_url": instagram_url}


def fetch_fan_count(artist_id: str) -> int | None:
    """
    멜론 내부 API로 아티스트 팬 수 조회.
    MELON_COOKIE 환경변수가 없으면 None 반환 (필터링 생략).
    """
    import os, json
    cookie = os.getenv("MELON_COOKIE", "").strip()
    if not cookie:
        return None

    try:
        headers = {**HEADERS, "Cookie": cookie, "X-Requested-With": "XMLHttpRequest"}
        resp = requests.get(
            "https://www.melon.com/commonlike/getArtistLike.json",
            params={"likeType": "A", "artistIds": artist_id},
            headers=headers,
            timeout=5,
        )
        data = resp.json()
        # 응답 구조: {"contsLike": [{"contsId": "...", "likeCount": 12345}]}
        items = data.get("contsLike") or data.get("likeList") or []
        if items:
            return int(items[0].get("likeCount", 0))
    except Exception as e:
        logger.debug("팬 수 조회 실패 (ID: %s): %s", artist_id, e)
    return None


def _extract_text(soup, selector: str) -> str | None:
    el = soup.select_one(selector)
    return el.get_text(strip=True) if el else None
