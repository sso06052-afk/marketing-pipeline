# Python 파이프라인 에이전트

## 역할
멜론 신곡 수집 → 인스타 탐색 → Gemini 판별 → Supabase 저장

## 파일별 담당
| 파일 | 역할 | 핵심 함수 |
|---|---|---|
| `melon_crawler.py` | 멜론 신곡 크롤링 | `crawl_new_songs() -> list[dict]` |
| `genie_crawler.py` | 지니 신곡 크롤링 + 아티스트 상세 | `crawl_new_songs()`, `fetch_artist_detail(artist_id)` |
| `finder.py` | 인스타 다중 검색 + Gemini 판단 | `find_instagram(artist) -> (handle, source, score, email, not_found_reason)` |
| `db.py` | Supabase 연동 | `upsert_artist`, `upsert_song`, `get_existing_artist_ids`, `get/increment_cse_usage` |
| `pipeline.py` | 전체 오케스트레이터 | `main(source)` |

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

## 인스타 탐색 로직 (finder.py)
검색 쿼리 4종 → 출처 태그 붙여 Gemini에게 전달 → Gemini 최종 판단

| 출처 태그 | 쿼리 |
|---|---|
| 인스타직접검색 | `{이름} site:instagram.com` |
| 일반검색 | `{이름} 인스타그램` 3가지 변형 |
| 나무위키검색 | `나무위키 {이름}` → URL 있으면 페이지 스크랩 |
| 소속사검색 | `{이름} {소속사} instagram` (소속사 있을 때) |

- Gemini 응답 형식: `핸들: <handle> / 확신: 높음|낮음`
- 확신 높음 → score=80 / 낮음 → score=55
- 없음 → needs_review=True
