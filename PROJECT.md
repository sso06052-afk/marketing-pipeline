# 음원 홍보 자동화 시스템 — 전체 설계 문서

## 프로젝트 개요

멜론 신곡 페이지에서 신규 가수를 자동 수집하고, 인스타그램/이메일 계정을 탐색해서 DB에 저장한 뒤, 팀장이 대시보드에서 원클릭으로 DM 발송할 수 있는 시스템.

총 3명 운영 (대표 포함). 홍보는 팀장 주 업무, 제작은 팀장+본인 모두 진행. 현재 관리 툴 없음. 서버/클라우드 없음.

---

## 현재 업무 흐름 (자동화 전)

```
멜론 신곡 페이지 수동 확인
    ↓
가수 인스타 직접 구글링 (빠르면 즉시, 길면 10분, 복잡하면 패스)
    ↓
인스타 못 찾으면 유튜브 채널 이메일 확인 후 메일 발송
    ↓
DM 발송 (정해진 첫 인사 문구 복붙)
    ↓
답장 오면 홍보 서비스 안내
    ↓
오픈카톡으로 넘김
    ↓
대표가 상품 안내 PDF 첨부 + 상담
    ↓
가수가 상품 선택 + 입금
    ↓
제작 진행
```

---

## 상품 구성

| 상품명 | 채널 | 담당 |
|---|---|---|
| 멜론플리 | 멜론 DJ 플리 댓글 삽입 요청 | 팀장 |
| 고막챙겨 | 유튜브 플레이리스트 영상 | 팀장 |
| 커스텀레코드 | 유튜브 리릭비디오 본사채널 업로드 | 팀장 |
| 좋대송 | 틱톡/인스타/쇼츠 클립 영상 | 팀장+본인 |
| 뮤뮤다옹 | 틱톡 리릭비디오 (가장 저렴) | 팀장 |

- 가격 비공개, 어느 정도 고정이나 아티스트 상황에 따라 조정
- 가수가 직접 선택, 조회수 동향 기반 추천 병행

---

## 채널 현황

| 채널명 | 플랫폼 | 용도 | 규모 |
|---|---|---|---|
| 커스텀레코드 | 유튜브 | 본사 채널, 리릭비디오 업로드 | - |
| 좋대송 | 유튜브 | 홍보 클립 영상 | - |
| 힙콩 | 유튜브 | 짤+음원 재배포 | - |
| 지금이데뷔 | 유튜브 | 짤+음원 재배포 | - |
| 뮤뮤다옹 | 틱톡 | 리릭비디오 | 8.3K |
| 좋대송 | 틱톡 | 홍보 클립 | 4.5K |
| 좋대송 | 인스타 | 콘텐츠 업로드 전용 | - |

---

## 기술 스택

| 역할 | 도구 |
|---|---|
| 스케줄러 | n8n (매일 오전 9시 트리거) |
| 크롤링/탐색 | Python (requests, BeautifulSoup) |
| 인스타 탐색 | Spotify API, YouTube Data API, Google CSE |
| AI 판별/생성 | Gemini API (gemini-2.0-flash, 무료 티어) |
| DB | Supabase (PostgreSQL) |
| 대시보드 | Next.js + Tailwind CSS |
| 알림 | Discord Webhook |
| 배포 | Vercel (대시보드), n8n 자체호스팅 (파이프라인) |

---

## DB 스키마

### artists 테이블

```sql
melon_artist_id   TEXT PRIMARY KEY
name              TEXT
genre             TEXT
agency            TEXT

-- 인스타 정보
instagram_handle  TEXT
instagram_url     TEXT
instagram_source  TEXT     -- melon / spotify / youtube / google / manual

-- 이메일 정보 (인스타 못 찾을 때 대체 루트)
email             TEXT
email_source      TEXT     -- youtube_about / manual

-- 신뢰도
confidence_score  INTEGER  -- 0~100
needs_review      BOOLEAN  DEFAULT false

-- 컨택 상태
contact_count     INTEGER  DEFAULT 0   -- 1차/2차 재발송 관리
contacted         BOOLEAN  DEFAULT false
contacted_date    TIMESTAMP
contact_method    TEXT     -- instagram / email
reply_received    BOOLEAN  DEFAULT false
reply_date        TIMESTAMP

created_at        TIMESTAMP DEFAULT now()
```

### songs 테이블

```sql
melon_song_id     TEXT PRIMARY KEY
melon_artist_id   TEXT REFERENCES artists
title             TEXT
album             TEXT
release_date      DATE
created_at        TIMESTAMP DEFAULT now()
```

---

## P1 — 가수 발굴 파이프라인

### 실행 흐름

```
매일 오전 9시 n8n 트리거
    ↓
[crawler.py] 멜론 신곡 페이지 크롤링
URL: https://www.melon.com/new/index.htm
수집: 곡명, 가수명, 앨범명, 발매일, 아티스트 ID
요청 간격 1~2초 sleep 필수
    ↓
[db.py] DB에 없는 신규 가수만 필터
melon_artist_id 기준으로 중복 제거
    ↓
[finder.py] 인스타 계정 탐색 (cascade)
    ↓
[finder.py] 이메일 탐색 (인스타 못 찾은 경우)
    ↓
[verifier.py] Gemini API 계정 판별
    ↓
[db.py] Supabase 저장
    ↓
[notifier.py] Discord 알림 발송
```

### 인스타 탐색 cascade

```
1순위: 멜론 아티스트 페이지 SNS 링크
    https://www.melon.com/artist/detail.htm?artistId={id}
    instagram.com 포함 링크 추출
    커버리지 ~30%, 무료 (단, JS 동적 로딩으로 실제 획득률 낮음)

2순위: Spotify API
    가수명으로 검색 → 이름 정확히 일치 → external_urls.instagram 추출
    커버리지 +30%, 무료

3순위: YouTube Data API
    "{가수명} official" 검색 → 채널 About → description에서 추출
    정규식: r'instagram\.com/[\w.]+'
    커버리지 +20%, 무료

4순위: Google Custom Search API
    쿼리: "{가수명} {앨범명} site:instagram.com"
    하루 100건 한도 엄수 → 1~3순위 실패한 경우만 사용
    p, reel, explore 등 일반 경로는 핸들에서 제외
    커버리지 +15%
```

### 이메일 탐색 (인스타 4단계 모두 실패 시)

```
YouTube 채널 About 탭 이메일 추출
정규식: r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
email, email_source = 'youtube_about' 저장
그래도 없으면 needs_review = true
```

### Gemini 계정 판별

```
후보 1개: confidence_score = 70, 바로 저장
후보 2개 이상: Gemini에게 판별 요청
    → 번호 응답: confidence_score = 90, needs_review = false
    → "불확실" 응답: confidence_score = 40, needs_review = true
후보 없음: instagram_handle = null, needs_review = true
```

### 2차 재발송 로직

```
contact_count = 0 → 미발송
contact_count = 1 → 1차 발송 완료
contact_count = 2 → 2차 발송 완료 (최대)
reply_received = false이고 contact_count = 1인 가수 → 2차 발송 대기 표시
```

### Discord 알림 형식

```
📋 오늘 신곡 수집 완료
신규 가수: N명
인스타 확보: N명 (N%)
이메일 확보: N명
수동 확인 필요: N명
발송 대기: N명
```

---

## 대시보드 — 페이지 구성

### / (메인 — 오늘 발송 리스트)

상단 지표 카드 4개
- 오늘 신규 가수 수
- 인스타 확보율 (%)
- 발송 완료 수
- 답장 수

가수 카드 리스트
- 오늘 created_at 기준, contacted = false 가수
- 페이지네이션 20명씩 (50명 기준 설계, 확장 용이하게)
- 카드 구성:
  - 가수명 · 장르 · 인스타 핸들 또는 이메일
  - confidence_score 60 이하 → "확인필요" 배지
  - contact_count = 1이고 reply_received = false → "2차발송" 배지

[DM 보내기] 버튼 (인스타 확보된 경우)
- navigator.clipboard.writeText("안녕하세요 {name}님")
- window.open("https://ig.me/m/{instagram_handle}", "_blank")
- contacted = true, contacted_date = now(), contact_count += 1

[메일 보내기] 버튼 (이메일만 확보된 경우)
- mailto:{email} 링크 열기
- contacted = true, contacted_date = now(), contact_count += 1, contact_method = 'email'

[답장옴] 버튼
- reply_received = true, reply_date = now()

### /review (수동 확인 큐)

needs_review = true인 가수 리스트
카드마다:
- 가수명 · 곡명 · 앨범명
- 멜론 아티스트 페이지 링크
- 인스타 핸들 직접 입력 필드
- [저장] 버튼 → instagram_handle, instagram_url 업데이트 + needs_review = false

### /stats (전체 통계)

- 전체 수집 가수 수
- 인스타 확보율 / 이메일 확보율
- 발송 대기 / 발송 완료 / 답장 수
- 인스타 source별 비율 (멜론 / 스포티파이 / 유튜브 / 구글 / 수동)
- 장르별 분포
- 날짜별 수집 추이
- 1차 발송 → 2차 발송 → 답장 퍼널

---

## 폴더 구조

```
marketing_pipeline/
├── pipeline/
│   ├── pipeline.py       # 메인 실행 파일
│   ├── crawler.py        # 멜론 신곡 크롤링
│   ├── finder.py         # 인스타/이메일 탐색 cascade
│   ├── verifier.py       # Gemini 계정 판별
│   ├── db.py             # Supabase 연동
│   ├── notifier.py       # Discord Webhook 알림
│   └── requirements.txt
├── dashboard/
│   ├── app/
│   │   ├── page.tsx            # 메인 발송 리스트
│   │   ├── review/page.tsx     # 수동 확인 큐
│   │   └── stats/page.tsx      # 전체 통계
│   ├── components/
│   │   ├── ArtistCard.tsx
│   │   ├── StatCard.tsx
│   │   └── Pagination.tsx
│   └── lib/
│       └── supabase.ts
├── .env
└── PROJECT.md
```

---

## 환경변수

```
# Supabase
SUPABASE_URL=
SUPABASE_KEY=

# 인스타 탐색
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
YOUTUBE_API_KEY=
GOOGLE_API_KEY=
GOOGLE_CSE_ID=

# AI 판별
GEMINI_API_KEY=

# 알림
DISCORD_WEBHOOK_URL=

# Next.js
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
```

---

## 주의사항

- 멜론 크롤링 요청 간격 1~2초 sleep 필수 (차단 방지)
- Google CSE 하루 100건 한도 엄수, 사용량 로깅
- 이미 contacted = true이고 contact_count = 2인 가수는 파이프라인에서 스킵
- Supabase RLS 설정 필요
- Next.js 환경변수 NEXT_PUBLIC_ 접두사 주의
- 대시보드는 Vercel 배포 기준
- n8n에서 매일 오전 9시 python pipeline/pipeline.py 실행
- 페이지네이션 20명씩, 나중에 100명/200명으로 늘려도 대응 가능하게 설계

---

## 현재 구현 상태

| 항목 | 상태 |
|---|---|
| Supabase DB (artists, songs, config) | ✅ 완료 |
| RLS / 트리거 / RPC 함수 | ✅ 완료 |
| crawler.py | ✅ 완료 (URL: /new/index.htm 확인) |
| finder.py | ✅ 완료 |
| verifier.py | ✅ 완료 |
| db.py | ✅ 완료 |
| pipeline.py | ✅ 완료 |
| notifier.py | 🔲 미구현 (Discord 키 미입력) |
| 대시보드 메인 (/) | ✅ 완료 |
| 대시보드 /review | ✅ 완료 |
| 대시보드 /stats | ✅ 완료 |
| .claude/agents (4개 페르소나) | ✅ 완료 |
| Supabase MCP 연결 | ✅ 완료 |
| n8n 스케줄러 | 🔲 미구현 (나중에) |
| Vercel 배포 | 🔲 미구현 (나중에) |

---

## 미확인 항목 (현장 추가 확인 필요)

- 오픈카톡 전환율 (대표 확인 필요)
- 계약률 및 계약 안 되는 주요 이유 (대표 확인 필요)
- 리릭비디오 / 유튜브 플리 영상 제작 시간 (팀장 확인 필요)
- 오픈카톡 이후 상담 흐름 상세 (대표 확인 필요)
- 팀장 인스타 계정 종류 (일반/크리에이터/비즈니스) — 비즈니스면 답장 자동 감지 가능
