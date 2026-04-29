# 플랜: melon_crawler 리네이밍 + genie_crawler 신규 추가

## Context
현재 `crawler.py`는 멜론 전용인데 파일 이름이 범용적. 지니 크롤러를 추가하면서 소스별로 파일을 명확히 분리하기 위해 리네이밍 후 지니 크롤러를 별도 파일로 작성.

---

## Step 1 — 파일 리네이밍

**변경 파일:**
- `pipeline/crawler.py` → `pipeline/melon_crawler.py` (내용 변경 없음)
- `pipeline/pipeline.py` L9: import 수정
  ```python
  # Before
  from crawler import crawl_new_songs, fetch_artist_detail, fetch_fan_count
  # After
  from melon_crawler import crawl_new_songs, fetch_artist_detail, fetch_fan_count
  ```
- `pipeline/CLAUDE.md` 파일 표에서 `crawler.py` → `melon_crawler.py` 업데이트

---

## Step 2 — DB 스키마 확장

**파일:** `supabase/` 하위에 마이그레이션 SQL 추가

```sql
ALTER TABLE artists ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'melon';
ALTER TABLE artists ADD COLUMN IF NOT EXISTS genie_artist_id TEXT;
```

- 기존 `melon_artist_id` 컬럼 유지 (멜론 아티스트는 그대로)
- 지니 전용 아티스트: `melon_artist_id = NULL`, `genie_artist_id = '지니ID'`
- `source` 컬럼: `'melon'` | `'genie'`

`pipeline/db.py` — `upsert_artist()` 함수에 `source`, `genie_artist_id` 필드 반영

---

## Step 3 — `genie_crawler.py` 신규 작성

**파일:** `pipeline/genie_crawler.py`

구현할 함수 (melon_crawler와 동일한 시그니처 유지):

```python
def crawl_new_songs() -> list[dict]:
    """지니 신곡 페이지에서 곡·가수 정보 수집"""

def fetch_artist_detail(artist_id: str) -> dict:
    """지니 아티스트 페이지에서 장르·소속사·SNS 수집"""
```

지니 타겟 URL:
- 신곡 목록: `https://www.genie.co.kr/new/index`
- 아티스트 상세: `https://www.genie.co.kr/detail/artistInfo?xxnm={artist_id}`

반환 dict는 멜론과 동일한 키 사용 + source 필드 추가:
```python
{
    "source": "genie",
    "genie_song_id": "...",
    "genie_artist_id": "...",
    "melon_artist_id": None,
    "name": "...",
    "title": "...",
    "album": "...",
    "release_date": None,
    "genre": None,
    "agency": None,
}
```

멜론 크롤러에서 재사용:
- `_get_with_retry()` 패턴 동일하게 적용
- `time.sleep(random.uniform(1, 2))` 요청 간격 동일
- HEADERS는 Referer만 지니 도메인으로 교체

지니는 팬 수 API 없음 → `fetch_fan_count()` 구현 생략 (None 반환 고정)

---

## Step 4 — `pipeline.py` 통합

`--source` 인자 추가:
```
python pipeline.py --source melon   # 기본값 (현재 동작 동일)
python pipeline.py --source genie
python pipeline.py --source both    # 순차 실행
```

소스별 크롤러 라우팅 래퍼:
```python
def _crawl(source: str) -> list[dict]:
    if source == "melon":
        return melon_crawler.crawl_new_songs()
    elif source == "genie":
        return genie_crawler.crawl_new_songs()
```

`upsert_artist()` 호출 시 `source`, `genie_artist_id` 필드 포함.
finder/verifier/db 로직은 변경 없이 공용 유지.

---

## 수정 파일 목록

| 파일 | 작업 |
|---|---|
| `pipeline/crawler.py` | 삭제 후 `melon_crawler.py`로 이동 |
| `pipeline/melon_crawler.py` | 신규 (내용 동일) |
| `pipeline/genie_crawler.py` | 신규 작성 |
| `pipeline/pipeline.py` | import 수정 + `--source` 인자 추가 |
| `pipeline/db.py` | `upsert_artist()` 필드 확장 |
| `pipeline/CLAUDE.md` | 파일 표 업데이트 |
| `supabase/migration_add_genie.sql` | 신규 마이그레이션 SQL |

---

## 검증 방법

1. **리네이밍 확인:** `python pipeline.py --melon-only` 정상 실행
2. **지니 크롤러 단독 테스트:** `python -c "from genie_crawler import crawl_new_songs; print(crawl_new_songs()[:2])"`
3. **통합 실행:** `python pipeline.py --source genie --melon-only`
4. **DB 확인:** Supabase에서 `source = 'genie'` 행 조회
