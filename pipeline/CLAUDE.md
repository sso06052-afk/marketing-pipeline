# Python 파이프라인 에이전트

## 역할
멜론 신곡 수집 → 인스타 탐색 → Gemini 판별 → Supabase 저장

## 파일별 담당
| 파일 | 역할 | 핵심 함수 |
|---|---|---|
| `crawler.py` | 멜론 신곡 크롤링 | `crawl_new_songs() -> list[dict]` |
| `finder.py` | 인스타 cascade 탐색 | `find_instagram(artist) -> (handle, source, score)` |
| `verifier.py` | Gemini 2.0 Flash 판별 | `verify_account(name, album, candidates) -> (handle, score, needs_review)` |
| `db.py` | Supabase 연동 | `upsert_artist`, `upsert_song`, `get_existing_artist_ids`, `get/increment_cse_usage` |
| `pipeline.py` | 전체 오케스트레이터 | `main()` |

## 환경변수 (모두 루트 .env에서 로드)
```
SUPABASE_URL, SUPABASE_KEY
SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
YOUTUBE_API_KEY
GOOGLE_API_KEY, GOOGLE_CSE_ID
GEMINI_API_KEY
```

## 핵심 규칙
- 멜론 요청 간격: `time.sleep(random.uniform(1, 2))` 필수
- 멜론 retry: 최대 3회, backoff 2^n초
- Google CSE: `db.get_cse_usage(today) >= 100`이면 스킵
- contacted=true 가수: upsert 시 덮어쓰지 않음 (DB 트리거로 이중 보호)
- 로깅: `logging` 모듈, `pipeline.log` 파일 저장

## cascade 탐색 순서 (finder.py)
1. 멜론 아티스트 페이지 SNS 링크
2. Spotify API (`spotipy`)
3. YouTube Data API v3 — 채널 description 정규식 `r'instagram\.com/([\w.]+)'`
4. Google CSE — 쿼리 `"{name} {album} site:instagram.com"` (한도 내에서만)

## Gemini 판별 로직 (verifier.py)
- 후보 0개 → handle=None, needs_review=True
- 후보 1개 → confidence=70, needs_review=False (Gemini 호출 생략)
- 후보 2개+ → Gemini 호출
  - 숫자 응답 → confidence=90, needs_review=False
  - "불확실" → confidence=40, needs_review=True
