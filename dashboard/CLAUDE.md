# Next.js 대시보드 에이전트

## 역할
팀장이 브라우저에서 인스타 DM을 원클릭으로 발송하는 대시보드

## 기술 스택
- Next.js 14 (App Router)
- Tailwind CSS
- Supabase JS (`@supabase/supabase-js`)
- TypeScript

## 페이지 구성 (2페이지)
| 경로 | 파일 | 역할 |
|---|---|---|
| `/` | `app/page.tsx` | 대시보드 — 파이프라인 실행, 오늘 통계, 탭별 발송 관리 |
| `/db` | `app/db/page.tsx` | 전체 관리 — 검색·필터·정렬 + 통계 탭 |

### `/` 탭 구성
- **발송대기**: 테이블 (ArtistRow)
- **검토필요**: 카드 UI (인스타 핸들 입력·저장), 미처리 시 빨간 dot 배지
- **발송완료**: 테이블
- **답장완료**: 테이블

### `/db` 뷰 구성
- **목록**: 검색(Enter) + 상태 칩 필터 + 정렬 select + ArtistRow 테이블
- **통계**: 인스타 출처별, 장르별, 날짜별 수집 추이 (14일)

## API Routes (서버사이드 전용)
| 경로 | 파일 | 동작 |
|---|---|---|
| `POST /api/contact` | `app/api/contact/route.ts` | contacted=true, contacted_date=now() |
| `POST /api/reply` | `app/api/reply/route.ts` | reply_received=true, reply_date=now() |
| `POST /api/handle` | `app/api/handle/route.ts` | instagram_handle 수동 저장, needs_review=false |
| `POST /api/memo` | `app/api/memo/route.ts` | memo, reply_result, followup_date 저장 |
| `POST /api/pipeline` | `app/api/pipeline/route.ts` | Python 파이프라인 SSE 스트림 실행 |

## 컴포넌트
| 파일 | 역할 |
|---|---|
| `components/ArtistRow.tsx` | 가수 행 (DM·이메일·답장·메모·핸들수정 인라인) |
| `components/StatCard.tsx` | 상단 지표 카드 |
| `components/Pagination.tsx` | 30개씩 페이지네이션 |
| `components/Toaster.tsx` | 토스트 알림 (success/error/info) |

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
