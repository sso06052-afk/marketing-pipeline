from __future__ import annotations
import re
import os
import logging
import requests
from bs4 import BeautifulSoup

from db import get_serper_usage, increment_serper_usage

logger = logging.getLogger(__name__)

INSTAGRAM_PATTERN = re.compile(r'instagram\.com/([\w.]+)(?:[/?]|$)')
EXCLUDE_PATHS = {
    "p", "reel", "reels", "explore", "tv", "stories",
    "accounts", "about", "popular", "tags", "locations",
    "direct", "share",
}

# 브랜드·쇼핑몰·팬계정으로 의심되는 핸들 → 점수 감점 (가수 본인 계정 아님)
NEGATIVE_HANDLE_KEYWORDS = (
    "shop", "store", "mall", "market", "goods", "md_", "_md",
    "fanbase", "fanpage", "fanclub", "fancafe", "_fan", "fan_",
    "official_store", "officialstore",
)


def _negative_handle_penalty(handle: str) -> int:
    h = handle.lower()
    return 35 if any(kw in h for kw in NEGATIVE_HANDLE_KEYWORDS) else 0

SERPER_URL = "https://google.serper.dev/search"

INSTA_VERIFY_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "ko-KR,ko;q=0.9",
    "x-ig-app-id": "936619743392459",
    "Referer": "https://www.instagram.com/",
}


def _fetch_instagram_profile(handle: str) -> dict | None:
    """
    Instagram 내부 API로 프로필 조회.
    반환:
      - dict(biography 등) : 200 OK, 프로필 확인됨 (bio 보너스 가능)
      - {}                 : 차단/레이트리밋(429·401·403 등) — 검증 불가, 핸들은 유지
      - None               : 실제로 계정 없음(404 또는 200+빈 user) → 폐기
    인스타는 비로그인 서버 요청을 자주 429로 막으므로, 200이 아니라고
    무조건 폐기하면 멀쩡한 핸들까지 버려진다. '진짜 없음'만 폐기한다.
    """
    import time as _time
    try:
        _time.sleep(0.5)
        resp = requests.get(
            f"https://www.instagram.com/api/v1/users/web_profile_info/?username={handle}",
            headers=INSTA_VERIFY_HEADERS,
            timeout=8,
        )
        if resp.status_code == 404:
            return None  # 진짜 계정 없음
        if resp.status_code != 200:
            # 429/401/403 등 — 인스타가 서버 요청을 차단. 검증 불가 → 핸들 유지
            logger.info("[insta] @%s 검증 불가 (status %s) — 핸들 유지", handle, resp.status_code)
            return {}
        user = resp.json().get("data", {}).get("user") or {}
        if not user:
            return None  # API가 정상 응답했는데 user 없음 = 실제 없음
        return {
            "biography": (user.get("biography") or "").lower(),
            "full_name": (user.get("full_name") or "").lower(),
            "follower_count": user.get("edge_followed_by", {}).get("count", 0),
        }
    except Exception:
        return {}  # 네트워크 오류 → 검증 불가로 간주, 핸들 유지


def _bio_score_bonus(profile: dict, artist_name: str, agency: str | None) -> int:
    """Bio/full_name에서 아티스트 이름·소속사 매칭 시 보너스 점수."""
    bio = profile.get("biography", "")
    full_name = profile.get("full_name", "")
    combined = bio + " " + full_name

    bonus = 0
    base_name = re.sub(r'\s*\([^)]*\)', '', artist_name).strip().lower()
    paren_m = re.search(r'\(([^)]+)\)', artist_name)
    alt_name = paren_m.group(1).strip().lower() if paren_m else None

    # 아티스트 이름 매칭 (한글 또는 영문)
    if base_name and len(base_name) >= 2 and base_name in combined:
        bonus += 10
    elif alt_name and len(alt_name) >= 2 and alt_name in combined:
        bonus += 10

    # 소속사명 매칭
    if agency and len(agency) >= 2 and agency.lower() in combined:
        bonus += 8

    # 공식 키워드
    if any(kw in combined for kw in ["official", "공식", "ofcl"]):
        bonus += 5

    return bonus


def _verified(
    name: str, handle: str, source: str, score: int,
    agency: str | None = None,
) -> tuple[str | None, str, int, str | None, str | None]:
    """핸들 반환 전 실존 확인 + bio 기반 점수 보정."""
    profile = _fetch_instagram_profile(handle)

    if profile is None:
        logger.warning("[%s] @%s — Instagram 계정 실존 안 함(404), 검토 필요", name, handle)
        return None, "none", 0, None, f"계정 없음: @{handle}"

    # bio 보너스 적용 (profile이 빈 dict이면 bonus=0)
    if profile:
        bonus = _bio_score_bonus(profile, name, agency)
        if bonus:
            new_score = min(score + bonus, 97)
            logger.info("[%s] @%s bio 보너스 +%d → %d점", name, handle, bonus, new_score)
            score = new_score

    return handle, source, score, None, None

# ACID 기반 소스별 기본 점수
SOURCE_BASE_SCORES = {
    "나무위키스크랩": 85,   # 커뮤니티 검증, SNS 직접 수록 → 높은 신뢰
    "인스타직접검색": 75,   # site:instagram.com URL 자체가 프로필 → 높음
    "소속사검색": 62,       # 소속사+이름 조합 → 중간
    "나무위키검색": 58,     # 나무위키 URL만 (스크랩 전) → 중간
    "일반검색": 50,         # 뉴스/팬사이트 언급 → 낮음
}


def find_instagram(artist: dict) -> tuple[str | None, str, int, str | None, str | None]:
    """반환: (handle, source, confidence_score, email, not_found_reason)"""
    from datetime import date
    name = artist["name"]

    # 1단계: 멜론 아티스트 페이지 직접 링크 → 최고 신뢰도
    melon_instagram_url = artist.get("instagram_url")
    if melon_instagram_url:
        handle = _extract_handle(melon_instagram_url)
        if handle:
            logger.info("[%s] 멜론 직링크 발견: @%s", name, handle)
            return _verified(name, handle, "melon", 90, artist.get("agency"))

    # 2단계: Serper 다중 쿼리
    today = date.today().isoformat()
    if get_serper_usage(today) >= 2500:
        logger.warning("[%s] Serper 일일 한도 초과, 스킵", name)
        return None, "none", 0, None, "Serper 일일 한도 초과"

    labeled_results = _search_serper_multi(
        name,
        song_title=artist.get("title", ""),
        agency=artist.get("agency"),
    )
    if not labeled_results:
        logger.info("[%s] 검색 결과 없음", name)
        return None, "none", 0, None, "검색 결과 없음"

    increment_serper_usage(today)

    # 3단계: 나무위키 스크랩 보강
    labeled_results = _enrich_with_namu(labeled_results, name)

    # 4단계: 후보 핸들 추출 + ACID 기반 점수 계산
    scored_candidates = _score_candidates(labeled_results, name)
    if not scored_candidates:
        logger.info("[%s] 핸들 후보 없음", name)
        return None, "none", 0, None, "후보 없음"

    top_handle, top_score = scored_candidates[0]
    second_score = scored_candidates[1][1] if len(scored_candidates) > 1 else 0

    # 5단계: 매우 명확한 단독 승자만 Gemini 스킵 (공식계정·다중출처 일치)
    if top_score >= 88 and (top_score - second_score) >= 15:
        logger.info("[%s] 확정 (Gemini 스킵): @%s (%d점)", name, top_handle, top_score)
        return _verified(name, top_handle, "google", top_score, artist.get("agency"))

    # 6단계: Gemini가 곡/앨범/소속사 증거로 '본인 계정'인지 판정 (최종 게이트)
    top_candidates = [h for h, _ in scored_candidates[:3]]
    gemini_pick, gemini_explicit_none = _ask_gemini(
        name, artist.get("title", ""), labeled_results, top_candidates,
        album=artist.get("album", "") or "", agency=artist.get("agency"),
    )

    if gemini_pick:
        final_score = next((s for h, s in scored_candidates if h == gemini_pick), top_score)
        logger.info("[%s] Gemini 선택: @%s (%d점)", name, gemini_pick, final_score)
        return _verified(name, gemini_pick, "google", final_score, artist.get("agency"))

    # Gemini가 '없음' 판정 OR 기술적 실패 → 틀린 추측 대신 검토필요 (오답 방지)
    if gemini_explicit_none:
        logger.info("[%s] Gemini 없음 판정 → 검토 필요", name)
        return None, "none", 0, None, "본인 계정 증거 불충분 — 수동 확인 필요"

    logger.info("[%s] Gemini 미응답 → 검토 필요", name)
    return None, "none", 0, None, "자동 판별 불가 — 수동 확인 필요"


# ──────────────────────────────────────────────
# 점수 계산
# ──────────────────────────────────────────────

def _score_candidates(results: list[dict], artist_name: str) -> list[tuple[str, int]]:
    """검색 결과에서 핸들 추출 후 ACID 기반 점수 계산. 점수 내림차순 반환."""
    handle_sources: dict[str, list[dict]] = {}

    # 스니펫 내 @handle 형식도 잡기 위한 패턴
    AT_HANDLE_PATTERN = re.compile(r'@([\w.]{2,})')

    for result in results:
        # URL에서 직접 추출 (인스타직접검색 결과일 때 핵심)
        url_handle = _extract_handle(result.get("url", ""))
        if url_handle:
            handle_sources.setdefault(url_handle, []).append(result)

        snippet = result.get("snippet", "")

        # 스니펫에서 instagram.com/handle 형식 추출
        for m in INSTAGRAM_PATTERN.finditer(snippet):
            h = m.group(1).rstrip("/")
            if h.lower() not in EXCLUDE_PATHS and len(h) >= 2:
                handle_sources.setdefault(h, []).append(result)

        # 스니펫에서 @handle 형식 추출 (Gemini 응답, 뉴스 기사 등)
        for m in AT_HANDLE_PATTERN.finditer(snippet):
            h = m.group(1).rstrip("/")
            if h.lower() not in EXCLUDE_PATHS and len(h) >= 2:
                handle_sources.setdefault(h, []).append(result)

    scored: list[tuple[str, int]] = []
    for handle, sources in handle_sources.items():
        score = _calculate_score(handle, artist_name, sources)
        scored.append((handle, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


def _calculate_score(handle: str, artist_name: str, sources: list[dict]) -> int:
    """
    ACID 기반 신뢰도 점수.
    = 최고 소스 기본점 + 교차검증 보너스 + 이름유사도 + 공식 키워드
    최대 95점 (100은 수동 입력 전용)
    """
    source_tags = [s.get("source_tag", "") for s in sources]

    # 1. 기본점: 이 핸들을 발견한 소스 중 가장 신뢰도 높은 것
    base_score = max(
        (SOURCE_BASE_SCORES.get(tag, 45) for tag in source_tags),
        default=45,
    )

    # 2. 교차검증 보너스: 서로 다른 소스 유형이 몇 개나 동의하는가
    unique_types = len(set(source_tags))
    if unique_types >= 3:
        corroboration = 15
    elif unique_types == 2:
        corroboration = 10
    else:
        corroboration = 0

    # 3. 이름 유사도 보너스: 핸들에 아티스트 이름의 영문 일부가 포함
    name_bonus = _name_similarity_bonus(handle, artist_name)

    # 4. 공식 키워드 보너스
    all_snippets = " ".join(s.get("snippet", "") for s in sources).lower()
    official_bonus = 5 if any(kw in all_snippets for kw in ["공식", "official", "ofcl"]) else 0

    # 5. 브랜드/쇼핑몰/팬계정 의심 핸들 감점
    penalty = _negative_handle_penalty(handle)

    score = base_score + corroboration + name_bonus + official_bonus - penalty
    return max(0, min(score, 95))


def _name_similarity_bonus(handle: str, artist_name: str) -> int:
    handle_lower = handle.lower()

    # 이름 내 영문 파트 (예: ON THE ROCK, GroovyRoom)
    alpha_parts = re.findall(r'[a-zA-Z]{2,}', artist_name)
    for part in alpha_parts:
        if part.lower() in handle_lower:
            return 5

    # 괄호 안 영문명 (예: 손예윤(Son Yeyoon))
    paren_m = re.search(r'\(([a-zA-Z][^)]+)\)', artist_name)
    if paren_m:
        eng = paren_m.group(1).lower().replace(" ", "")
        if len(eng) >= 3 and eng in handle_lower:
            return 5

    return 0


# ──────────────────────────────────────────────
# 검색
# ──────────────────────────────────────────────

def _search_serper_multi(name: str, song_title: str = "", agency: str | None = None) -> list[dict]:
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        logger.warning("SERPER_API_KEY 없음")
        return []

    paren_match = re.search(r'\(([^)]+)\)', name)
    alt_name = paren_match.group(1).strip() if paren_match else None
    base_name = re.sub(r'\s*\([^)]*\)', '', name).strip()
    search_name = alt_name if alt_name and alt_name.isascii() else base_name

    query_plan: list[tuple[str, str, int]] = []
    # 1. 인스타 직접 검색
    query_plan.append(("인스타직접검색", f"{search_name} site:instagram.com", 5))
    # 2. 인스타 직접 + 곡명 → 본인 계정 특정(동명이인 배제)
    if song_title:
        query_plan.append(("인스타직접검색", f"{search_name} {song_title} site:instagram.com", 3))
    # 3. '가수 {이름} 인스타' → 가수 명시로 브랜드/동명이인 배제
    query_plan.append(("일반검색", f"가수 {base_name} 인스타", 5))
    # 4. 곡명 포함 일반검색 → 강한 본인 증거
    if song_title:
        query_plan.append(("일반검색", f"{base_name} {song_title} 인스타그램", 5))
    # 5. 영문 활동명이 한글과 다르면 그것도 직접검색
    if alt_name and search_name != base_name:
        query_plan.append(("인스타직접검색", f"{base_name} site:instagram.com", 3))
    query_plan.append(("나무위키검색", f"{base_name} 나무위키", 3))
    if agency:
        query_plan.append(("소속사검색", f"{base_name} {agency} instagram", 3))

    seen_urls: set[str] = set()
    results: list[dict] = []

    for source_tag, query, num in query_plan:
        try:
            resp = requests.post(
                SERPER_URL,
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={"q": query, "num": num},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            for item in data.get("organic", []):
                url = item.get("link", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    results.append({
                        "source_tag": source_tag,
                        "query": query,
                        "title": item.get("title", ""),
                        "url": url,
                        "snippet": item.get("snippet", ""),
                    })
        except Exception as e:
            logger.warning("Serper 탐색 실패 [%s]: %s", source_tag, e)

    return results


def _enrich_with_namu(results: list[dict], name: str) -> list[dict]:
    namu_urls = [r["url"] for r in results if "namu.wiki/w/" in r.get("url", "")]
    if not namu_urls:
        return results

    base_name = re.sub(r'\s*\([^)]*\)', '', name).strip().lower()
    paren_match = re.search(r'\(([^)]+)\)', name)
    alt_name = paren_match.group(1).strip().lower() if paren_match else None

    namu_url = namu_urls[0]
    try:
        resp = requests.get(
            namu_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                              "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,"
                          "image/webp,*/*;q=0.8",
                "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept-Encoding": "gzip, deflate, br",
                "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1",
            },
            timeout=10,
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        page_title = soup.title.get_text(strip=True).lower() if soup.title else ""
        h1_text = soup.select_one("h1")
        h1_text = h1_text.get_text(strip=True).lower() if h1_text else ""
        combined = page_title + " " + h1_text

        if not (base_name in combined or (alt_name and alt_name in combined)):
            logger.info("[%s] 나무위키 페이지 무관 → 스킵 (%s)", name, page_title[:40])
            return results

        insta_handles = []
        for a in soup.find_all("a", href=True):
            h = _extract_handle(a["href"])
            if h:
                insta_handles.append(h)

        handles = list(dict.fromkeys(insta_handles))
        if handles:
            snippet = "나무위키 SNS 정보: " + ", ".join(f"instagram.com/{h}" for h in handles)
            results.append({
                "source_tag": "나무위키스크랩",
                "query": "",
                "title": f"{name} - 나무위키",
                "url": namu_url,
                "snippet": snippet,
            })
            logger.info("[%s] 나무위키 스크랩: %s", name, snippet)

    except Exception as e:
        logger.warning("[%s] 나무위키 스크랩 실패: %s", name, e)

    return results


# ──────────────────────────────────────────────
# Gemini (핸들 선택 전용 — 점수 판단 안 함)
# ──────────────────────────────────────────────

def _ask_gemini(name: str, title: str, results: list[dict], candidates: list[str],
                album: str = "", agency: str | None = None) -> tuple[str | None, bool]:
    """수집한 곡 정보(곡명/앨범/소속사)와 일치하는 '그 곡을 부른 가수 본인'의
    인스타 핸들을 Gemini가 판정. 반환: (handle, explicit_none)."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None, False

    lines = []
    for i, r in enumerate(results, 1):
        tag = r.get("source_tag", "")
        lines.append(
            f"{i}. [출처: {tag}]\n"
            f"   URL: {r['url']}\n"
            f"   제목: {r['title']}\n"
            f"   내용: {r['snippet'][:200]}"
        )
    context = "\n\n".join(lines)
    candidates_str = ", ".join(f"@{h}" for h in candidates)

    album_part = f", 앨범 '{album}'" if album else ""
    agency_part = f", 소속사 '{agency}'" if agency else ""

    prompt = (
        f"음원사이트에서 곡 '{title}'{album_part}을(를) 발표한 가수 '{name}'{agency_part} 의 정보를 수집했습니다.\n"
        f"이 곡을 부른 **바로 그 가수 '{name}' 본인**의 인스타그램 계정을 찾는 것이 목표입니다.\n\n"
        f"후보 핸들: {candidates_str}\n"
        f"(후보에 없으면 아래 검색 결과에서 직접 찾아도 됩니다.)\n\n"
        f"[판단 규칙 — 엄격하게]\n"
        f"1. 반드시 위 곡 '{title}'을(를) 부른 그 가수 본인의 계정이어야 합니다. "
        f"검색 결과에 이 곡명·앨범명·소속사·가수 활동명이 나타나 '그 가수가 맞다'는 근거가 있는 계정만 선택하세요.\n"
        f"2. 절대 선택 금지: 동명이인(다른 가수·다른 분야·외국인), 브랜드·쇼핑몰·굿즈·소속사몰 계정, "
        f"팬계정·팬페이지, 드라마/프로그램 계정.\n"
        f"3. 한글 이름과 영문 핸들의 로마자 표기가 일치할 수 있습니다(예: 허진호 → heojinho). "
        f"단, 이름 유사성만으로는 부족하고 곡/앨범/소속사 근거와 함께여야 합니다.\n"
        f"4. '이 곡을 부른 가수가 맞다'는 근거가 부족하면 추측하지 말고 반드시 '없음'으로 답하세요. "
        f"틀린 계정을 고르는 것보다 '없음'이 낫습니다.\n\n"
        f"검색 결과:\n{context}\n\n"
        f"답 형식(아래 둘 중 하나만):\n"
        f"핸들: <핸들>\n"
        f"없음"
    )

    try:
        import time as _time
        for attempt in range(3):
            resp = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=45,
            )
            if resp.status_code not in (429, 503):
                break
            _time.sleep(5 * (attempt + 1))
        resp.raise_for_status()
        body = resp.json()
        cands = body.get("candidates")
        if not cands:
            logger.warning("[%s] Gemini candidates 없음: %s", name, str(body)[:200])
            return None, False
        parts = cands[0].get("content", {}).get("parts", [])
        if not parts or "text" not in parts[0]:
            return None, False
        answer = parts[0]["text"].strip()
        # 마지막 줄만 로그 (앞부분은 긴 분석 텍스트)
        answer_summary = answer.splitlines()[-1].strip() if answer else ""
        logger.info("[%s] Gemini: %s", name, answer_summary)

        if "없음" in answer:
            return None, True

        # ASCII 핸들만 추출 (한글 등 비ASCII 매칭 방지)
        m = re.search(r'핸들\s*:\s*[`@]?([a-zA-Z0-9_.]{2,})', answer)
        if m:
            handle = m.group(1).strip()
            if handle.lower() not in EXCLUDE_PATHS:
                return handle, False

    except Exception as e:
        logger.warning("[%s] Gemini 실패: %s", name, e)

    return None, False


def _extract_handle(url: str) -> str | None:
    match = INSTAGRAM_PATTERN.search(url)
    if not match:
        return None
    handle = match.group(1).rstrip("/")
    if handle.lower() in EXCLUDE_PATHS:
        return None
    return handle
