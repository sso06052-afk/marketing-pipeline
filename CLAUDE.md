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

## 워크플로우 규칙

### 플랜
- 3단계 이상이거나 구조 변경이 포함된 작업 → 플랜 모드 먼저
- 예상과 다른 상황 발생 시 → 즉시 멈추고 재플랜
- 플랜은 `tasks/todo.md`에 체크리스트로 작성

### 실수 학습
- 사용자 교정 발생 시 → `tasks/lessons.md` 즉시 업데이트
- 새 대화 시작 시 → `tasks/lessons.md` 먼저 확인

### 완료 전 검증
- 크롤러 수정 → 실제 실행 후 결과 확인
- DB 변경 → Supabase에서 실제 행 확인
- UI 수정 → 브라우저에서 직접 확인
- "완료"는 증명된 것만

### 핵심 원칙
- 가장 단순한 방법으로. 건드리는 코드 최소화
- 임시방편 금지. 근본 원인 해결
- 우아한 해결책이 있으면 찾아낼 것
