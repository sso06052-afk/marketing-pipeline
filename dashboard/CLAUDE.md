# Next.js 대시보드 에이전트

## 역할
팀장이 브라우저에서 인스타 DM을 원클릭으로 발송하는 대시보드

## 기술 스택
- Next.js 14 (App Router)
- Tailwind CSS
- Supabase JS (`@supabase/supabase-js`)
- TypeScript

## 페이지 구성
| 경로 | 파일 | 역할 |
|---|---|---|
| `/` | `app/page.tsx` | 오늘 발송 리스트 (메인) |
| `/review` | `app/review/page.tsx` | 수동 확인 큐 (needs_review=true) |
| `/stats` | `app/stats/page.tsx` | 전체 현황 통계 |

## API Routes (서버사이드 전용)
| 경로 | 파일 | 동작 |
|---|---|---|
| `POST /api/contact` | `app/api/contact/route.ts` | contacted=true, contacted_date=now() |
| `POST /api/reply` | `app/api/reply/route.ts` | reply_received=true, reply_date=now() |

## 컴포넌트
| 파일 | 역할 |
|---|---|
| `components/ArtistCard.tsx` | 가수 카드 (DM 버튼, 답장 버튼, 배지) |
| `components/StatCard.tsx` | 상단 지표 카드 |
| `components/Pagination.tsx` | 20개씩 페이지네이션 |

## Supabase 클라이언트
- `lib/supabase.ts` — 클라이언트 초기화
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- API Routes에서는 `SUPABASE_SERVICE_KEY` 사용 (서버사이드 전용)

## 핵심 규칙
- `NEXT_PUBLIC_` 접두사: Supabase URL·anon key만 노출
- 클립보드 API: `navigator.clipboard` 실패 시 `document.execCommand('copy')` fallback
- DM 버튼 클릭 시 동시 실행:
  1. 클립보드에 DM 문구 복사
  2. `window.open("https://ig.me/m/{handle}", "_blank")`
  3. `POST /api/contact` 호출 → DB 업데이트
  4. 버튼 상태 "발송완료"로 변경
- confidence_score ≤ 60 → "확인필요" 배지 표시
- 페이지네이션: 20개씩, URL 쿼리 파라미터 `?page=N`
