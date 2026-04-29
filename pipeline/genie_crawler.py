from __future__ import annotations
import time
import random
import logging
import re
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

GENIE_NEW_SONGS_URL = "https://www.genie.co.kr/newest/song"
GENIE_ARTIST_URL = "https://www.genie.co.kr/detail/artistInfo?xxnm={artist_id}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.genie.co.kr/new/index",
    "Connection": "keep-alive",
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


def crawl_new_songs(max_pages: int = 1) -> list[dict]:
    """
    지니 신곡 페이지에서 곡·가수 정보를 수집.
    max_pages: 크롤링할 최대 페이지 수 (기본 1). GenreCode=hot&pg=N 파라미터로 페이지 이동.
    반환: [{source, genie_song_id, genie_artist_id, melon_artist_id, name, title, album, ...}, ...]
    """
    logger.info("지니 신곡 페이지 크롤링 시작 (최대 %d페이지)", max_pages)

    results = []
    seen_artist_ids: set[str] = set()
    seen_song_ids: set[str] = set()

    for page in range(1, max_pages + 1):
        params = {"GenreCode": "hot", "pg": page}
        try:
            resp = _get_with_retry(GENIE_NEW_SONGS_URL, params=params)
        except Exception as e:
            logger.warning("페이지 %d 요청 실패: %s", page, e)
            break

        soup = BeautifulSoup(resp.text, "html.parser")
        rows = soup.select("table tbody tr")
        if not rows:
            rows = soup.select(".list-wrap li")

        if not rows:
            logger.info("페이지 %d: 행 없음 — 중단", page)
            break

        page_count = 0
        for row in rows:
            try:
                song_data = _parse_row(row)
                if not song_data:
                    continue

                artist_id = song_data["genie_artist_id"]
                song_id = song_data["genie_song_id"]

                # 아티스트·곡 양쪽 모두 중복 체크
                if artist_id and artist_id in seen_artist_ids:
                    continue
                if song_id and song_id in seen_song_ids:
                    continue

                if artist_id:
                    seen_artist_ids.add(artist_id)
                if song_id:
                    seen_song_ids.add(song_id)

                results.append(song_data)
                page_count += 1
            except Exception as e:
                logger.warning("행 파싱 실패: %s", e)
                continue

            time.sleep(random.uniform(0.5, 1.2))

        logger.info("페이지 %d 수집: %d곡", page, page_count)

        if page < max_pages:
            time.sleep(random.uniform(2, 3))

    logger.info("지니 신곡 수집 완료: 총 %d곡 (%d페이지)", len(results), max_pages)
    return results


def _parse_row(row) -> dict | None:
    # 곡 ID (tr 속성)
    genie_song_id = row.get("songid")

    # 곡명
    title_el = row.select_one("a.title.ellipsis")
    if not title_el:
        return None
    title = title_el.get_text(strip=True)

    # 가수명 + 아티스트 ID (onclick="fnViewArtist(12345)")
    artist_el = row.select_one("a.artist.ellipsis")
    if not artist_el:
        return None
    name = artist_el.get_text(strip=True)
    onclick = artist_el.get("onclick", "")
    artist_id = _extract_artist_id(onclick)

    # 앨범명 + album ID (발매일 조회에 사용)
    album_el = row.select_one("a.albumtitle.ellipsis")
    album = album_el.get_text(strip=True) if album_el else ""
    album_onclick = album_el.get("onclick", "") if album_el else ""
    album_id_m = re.search(r'fnViewAlbumLayer\((\d+)\)', album_onclick)
    album_id = album_id_m.group(1) if album_id_m else None

    # 발매일 — 앨범 상세 페이지에서 가져옴
    release_date = _fetch_release_date(album_id) if album_id else None

    return {
        "source": "genie",
        "genie_song_id": genie_song_id,
        "genie_artist_id": artist_id,
        "melon_artist_id": None,
        "name": name,
        "title": title,
        "album": album,
        "release_date": release_date,
        "genre": None,
        "agency": None,
    }


def _fetch_release_date(album_id: str) -> str | None:
    """지니 앨범 상세 페이지에서 발매일 추출 (YYYY-MM-DD)"""
    try:
        url = f"https://www.genie.co.kr/detail/albumInfo?axnm={album_id}"
        resp = _get_with_retry(url)
        soup = BeautifulSoup(resp.text, "html.parser")
        # 페이지 상단 앨범 정보에서 YYYY.MM.DD 형식 첫 번째 날짜 추출
        for el in soup.select(".info-zone span, .album-info span, li, dd"):
            txt = el.get_text(strip=True)
            m = re.match(r'^(\d{4}\.\d{2}\.\d{2})$', txt)
            if m:
                return m.group(1).replace(".", "-")
    except Exception as e:
        logger.warning("발매일 조회 실패 (album_id=%s): %s", album_id, e)
    return None


def _extract_artist_id(onclick: str) -> str | None:
    match = re.search(r'fnViewArtist\((\d+)\)', onclick)
    return match.group(1) if match else None


def fetch_artist_detail(artist_id: str) -> dict:
    """
    지니 아티스트 페이지에서 장르·소속사·SNS 링크 수집.
    반환: {genre, agency, instagram_url}
    """
    time.sleep(random.uniform(1, 2))
    url = GENIE_ARTIST_URL.format(artist_id=artist_id)
    try:
        resp = _get_with_retry(url)
    except Exception as e:
        logger.warning("지니 아티스트 상세 페이지 실패 (ID: %s): %s", artist_id, e)
        return {"genre": None, "agency": None, "instagram_url": None}

    soup = BeautifulSoup(resp.text, "html.parser")

    genre = None
    agency = None

    # 장르·소속사 (.info-data li 구조)
    for li in soup.select(".info-zone .info-data li"):
        attr_img = li.select_one(".attr img")
        value_el = li.select_one(".value")
        if not attr_img or not value_el:
            continue
        label = attr_img.get("alt", "")
        value = value_el.get_text(strip=True)
        if "장르" in label:
            genre = value
        elif "소속사" in label:
            agency = value

    # 지니 아티스트 상세 페이지에는 아티스트 개인 인스타 링크가 없음
    # (footer에 genie_music만 존재) → finder.py Serper+Gemini로 탐색
    return {"genre": genre, "agency": agency, "instagram_url": None}
