# 마케팅 파이프라인 — 루트

## 프로젝트 구조
```
marketing_pipeline/
├── pipeline/    ← Python 파이프라인 (pipeline/CLAUDE.md 참조)
├── dashboard/   ← Next.js 대시보드 (dashboard/CLAUDE.md 참조)
├── supabase/    ← DB 스키마 SQL
└── .env         ← 모든 환경변수
```

## 에이전트 라우팅
| 작업 영역 | 이동할 디렉토리 | 참조 CLAUDE.md |
|---|---|---|
| Python 크롤링·탐색·판별·DB | `pipeline/` | `pipeline/CLAUDE.md` |
| Next.js 대시보드·컴포넌트·API | `dashboard/` | `dashboard/CLAUDE.md` |
| DB 스키마·RLS | `supabase/` | 루트 CLAUDE.md |

## Supabase 테이블 요약
- `artists` — 가수 정보 + 인스타 + 연락 상태
- `songs` — 곡 정보 (artists 외래키)
- `config` — Google CSE 일별 사용량 (`cse_usage_YYYY-MM-DD` 키)
