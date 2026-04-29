# 플랜: /db 페이지를 종합 관리 허브로 개선

## Context
현재 `/db` 페이지는 읽기 전용 목록. 발송·답장 처리는 메인(/) 에서만 가능.
홍보 담당자 입장에서 필요한 건 하나의 페이지에서:
- 가수/곡 메타데이터 + 인스타 + 이전 컨택 이력/결과를 한눈에 보고
- "보류였던 사람만" "거절했던 사람 제외" 같은 필터로 추려서
- 거기서 바로 발송까지 할 수 있는 구조

---

## Step 1 — DB 스키마: 컨택 이력 컬럼 추가

**파일:** `supabase/schema.sql`

```sql
ALTER TABLE artists ADD COLUMN IF NOT EXISTS reply_result TEXT
  CHECK (reply_result IN ('긍정', '거절', '보류'));
ALTER TABLE artists ADD COLUMN IF NOT EXISTS memo TEXT;
```

`reply_result`: 답장 왔을 때 결과 분류 (긍정/거절/보류)
`memo`: 자유 텍스트 메모 ("3월에 다시 연락", "타사 계약 중" 등)

---

## Step 2 — TypeScript 타입 업데이트

**파일:** `dashboard/lib/supabase.ts`

`Artist` 타입에 추가:
```ts
reply_result: '긍정' | '거절' | '보류' | null;
memo: string | null;
```

---

## Step 3 — API Route 추가/수정

**`dashboard/app/api/reply/route.ts` 수정**
`reply_result`, `memo`도 함께 받아서 업데이트:
```ts
// body: { melon_artist_id, reply_result, memo }
// update: { reply_received: true, reply_date: now(), reply_result, memo }
```

**`dashboard/app/api/memo/route.ts` 신규**
이미 reply_received=true인 가수의 memo/reply_result만 단독 수정용:
```ts
// body: { melon_artist_id, reply_result, memo }
// update: { reply_result, memo }
```

---

## Step 4 — /db 페이지 전면 개선

**파일:** `dashboard/app/db/page.tsx`

### 4-1. 필터 바 (상단)

```
[가수명 검색___] [상태 ▼] [장르 ▼] [인스타 유무 ▼] [정렬 ▼]  [초기화]
```

상태 필터 옵션:
- 전체
- 발송 대기 (contacted=false, needs_review=false)
- 발송 완료 (contacted=true, reply_received=false)
- 답장 — 긍정 (reply_result='긍정')
- 답장 — 보류 (reply_result='보류') ← 재연락 대상
- 답장 — 거절 (reply_result='거절')
- 검토 필요 (needs_review=true)

정렬 옵션: 수집일 최신순, 수집일 오래된순, 신뢰도 높은순, 발송일 최신순, 이름 가나다순

### 4-2. 테이블 컬럼 구성 (현재 12개 → 재정리)

| 컬럼 | 내용 |
|---|---|
| 가수명 | 이름 + 장르/소속사 (2줄) + 메모 있으면 📝 아이콘 |
| 대표곡 | 곡명 + 앨범 |
| 인스타 / 이메일 | 링크 + 출처 뱃지 |
| 신뢰도 | 숫자 (색상 코딩) |
| 컨택 상태 | 발송일, 발송횟수, 발송수단 한 셀에 묶어서 |
| 답장 결과 | 긍정/거절/보류 뱃지 (없으면 —) |
| 메모 | 최대 30자 truncate, hover 시 전체 표시 |
| 액션 | DM 버튼 + 답장처리 버튼 (현재 메인과 동일하게) |

### 4-3. 인라인 액션 (ArtistRow 로직 /db에도 적용)

- **DM 버튼**: 클립보드 복사 + ig.me 열기 + `/api/contact` 호출
- **답장 버튼**: 클릭 시 해당 행에 인라인 폼 펼치기
  ```
  결과: [ 긍정 ]  [ 거절 ]  [ 보류 ]
  메모: ______________________________  [저장]
  ```
- **메모 수정**: 이미 답장 처리된 가수도 📝 클릭하면 메모 인라인 편집 가능

---

## Step 5 — ArtistRow 컴포넌트: 답장 폼 추가

**파일:** `dashboard/components/ArtistRow.tsx`

메인(/) 페이지의 ArtistRow에도 동일하게 적용:
- "답장" 버튼 클릭 → 인라인 폼 (긍정/거절/보류 + 메모)
- 저장 후 `reply_result` 뱃지 표시

---

## 수정 파일 목록

| 파일 | 작업 |
|---|---|
| `supabase/schema.sql` | `reply_result`, `memo` 컬럼 추가 |
| `dashboard/lib/supabase.ts` | `Artist` 타입 필드 추가 |
| `dashboard/app/api/reply/route.ts` | `reply_result`, `memo` 받도록 수정 |
| `dashboard/app/api/memo/route.ts` | 신규 — 메모 단독 수정 |
| `dashboard/app/db/page.tsx` | 필터 바 + 정렬 + 액션 버튼 + 메모 컬럼 추가 |
| `dashboard/components/ArtistRow.tsx` | 답장 버튼 → 인라인 결과/메모 폼 |

---

## 검증 방법

1. `/db`에서 상태 필터 "보류"로 설정 → 보류 가수만 보이는지 확인
2. 해당 가수에게 바로 DM 버튼으로 발송 → DB에 contacted=true 기록되는지 확인
3. 답장 버튼 → 결과 선택 + 메모 저장 → `reply_result`, `memo` 컬럼 확인
4. 메모 📝 클릭 → 인라인 편집 후 저장 → 변경값 반영 확인
5. 정렬 드롭다운 변경 시 목록 순서 바뀌는지 확인
