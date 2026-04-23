from __future__ import annotations
import re
import os
import logging
import time
import random

from db import get_cse_usage, increment_cse_usage

logger = logging.getLogger(__name__)

INSTAGRAM_PATTERN = re.compile(r'instagram\.com/([\w.]+)(?:[/?]|$)')
EMAIL_PATTERN = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
EXCLUDE_PATHS = {"p", "reel", "reels", "explore", "tv", "stories", "accounts", "about"}
EMAIL_EXCLUDE_DOMAINS = {"example.com", "gmail.com", "naver.com", "daum.net"}  # 개인 메일 제외


def find_instagram(artist: dict) -> tuple[str | None, str, int, str | None]:
    """
    4단계 cascade로 인스타그램 핸들 탐색.
    인스타 미발견 시 YouTube 채널 description에서 이메일 추출.
    반환: (handle, source, confidence_score, email)
    """
    name = artist["name"]
    album = artist.get("album", "")

    # 1단계: 멜론 아티스트 페이지
    melon_instagram_url = artist.get("instagram_url")
    if melon_instagram_url:
        handle = _extract_handle(melon_instagram_url)
        if handle:
            logger.info("[%s] 멜론에서 인스타 발견: @%s", name, handle)
            return handle, "melon", 85, None

    # 2단계: Spotify API
    handle = _search_spotify(name)
    if handle:
        logger.info("[%s] Spotify에서 인스타 발견: @%s", name, handle)
        return handle, "spotify", 80, None

    # 3단계: YouTube Data API (인스타 + 이메일 동시 탐색)
    yt_handle, yt_email = _search_youtube(name)
    if yt_handle:
        logger.info("[%s] YouTube에서 인스타 발견: @%s", name, yt_handle)
        return yt_handle, "youtube", 75, None

    # 4단계: Google CSE (한도 내에서만)
    from datetime import date
    today = date.today().isoformat()
    if get_cse_usage(today) < 100:
        handle = _search_google_cse(name, album)
        if handle:
            increment_cse_usage(today)
            logger.info("[%s] Google CSE에서 인스타 발견: @%s", name, handle)
            return handle, "google", 65, None
    else:
        logger.warning("[%s] Google CSE 일일 한도 초과, 스킵", name)

    # 인스타 미발견 → YouTube에서 추출한 이메일 반환
    if yt_email:
        logger.info("[%s] 인스타 미발견, 이메일 확보: %s", name, yt_email)
    else:
        logger.info("[%s] 인스타·이메일 모두 미발견", name)

    return None, "none", 0, yt_email


def _extract_handle(url: str) -> str | None:
    match = INSTAGRAM_PATTERN.search(url)
    if not match:
        return None
    handle = match.group(1).rstrip("/")
    if handle.lower() in EXCLUDE_PATHS:
        return None
    return handle


def _search_spotify(name: str) -> str | None:
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None

    try:
        import spotipy
        from spotipy.oauth2 import SpotifyClientCredentials
        sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
            client_id=client_id,
            client_secret=client_secret,
        ))
        results = sp.search(q=f"artist:{name}", type="artist", limit=5)
        artists = results.get("artists", {}).get("items", [])

        for artist in artists:
            if artist["name"].lower() == name.lower():
                external_urls = artist.get("external_urls", {})
                instagram_url = external_urls.get("instagram")
                if instagram_url:
                    return _extract_handle(instagram_url)

                # Spotify는 직접 instagram URL을 external_urls에 노출하지 않는 경우가 많음
                # artist URI로 상세 조회
                detail = sp.artist(artist["id"])
                for _, url in detail.get("external_urls", {}).items():
                    if "instagram.com" in url:
                        return _extract_handle(url)
    except Exception as e:
        logger.warning("Spotify 탐색 실패: %s", e)

    return None


def _search_youtube(name: str) -> tuple[str | None, str | None]:
    """
    YouTube 채널 description에서 인스타 핸들과 이메일을 동시에 추출.
    반환: (instagram_handle, email)
    """
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        return None, None

    try:
        from googleapiclient.discovery import build
        youtube = build("youtube", "v3", developerKey=api_key)

        search_resp = youtube.search().list(
            q=f"{name} official",
            part="snippet",
            type="channel",
            maxResults=3,
        ).execute()

        channel_ids = [
            item["snippet"]["channelId"]
            for item in search_resp.get("items", [])
        ]

        if not channel_ids:
            return None, None

        channels_resp = youtube.channels().list(
            id=",".join(channel_ids),
            part="snippet",
        ).execute()

        for channel in channels_resp.get("items", []):
            description = channel.get("snippet", {}).get("description", "")

            instagram_handle = None
            ig_match = INSTAGRAM_PATTERN.search(description)
            if ig_match:
                handle = ig_match.group(1).rstrip("/")
                if handle.lower() not in EXCLUDE_PATHS:
                    instagram_handle = handle

            email = _extract_business_email(description)

            if instagram_handle or email:
                return instagram_handle, email

    except Exception as e:
        logger.warning("YouTube 탐색 실패: %s", e)

    return None, None


def _extract_business_email(text: str) -> str | None:
    """description에서 비즈니스 이메일 추출 (개인 메일 도메인 제외)"""
    matches = EMAIL_PATTERN.findall(text)
    for email in matches:
        domain = email.split("@")[1].lower()
        if domain not in EMAIL_EXCLUDE_DOMAINS:
            return email
    return None


def _search_google_cse(name: str, album: str) -> str | None:
    api_key = os.getenv("GOOGLE_API_KEY")
    cse_id = os.getenv("GOOGLE_CSE_ID")
    if not api_key or not cse_id:
        return None

    try:
        from googleapiclient.discovery import build
        service = build("customsearch", "v1", developerKey=api_key)
        query = f"{name} {album} site:instagram.com".strip()
        result = service.cse().list(q=query, cx=cse_id, num=5).execute()

        candidates = []
        for item in result.get("items", []):
            link = item.get("link", "")
            match = INSTAGRAM_PATTERN.search(link)
            if match:
                handle = match.group(1).rstrip("/")
                if handle.lower() not in EXCLUDE_PATHS:
                    candidates.append(handle)

        # 중복 제거 후 가장 많이 등장한 핸들 반환
        if candidates:
            return max(set(candidates), key=candidates.count)

    except Exception as e:
        logger.warning("Google CSE 탐색 실패: %s", e)

    return None
