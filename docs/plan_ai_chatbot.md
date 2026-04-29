# AI 챗봇 연결 플랜

## 목적
대시보드 사용자가 자연어로 DB 현황을 조회할 수 있는 인라인 챗봇.
데이터가 충분히 쌓인 시점(가수 500명+)에 구현 권장.

---

## 구조

```
사용자 질문
    ↓
Next.js API Route (/api/chat)
    ↓
Claude API (claude-haiku-4-5 — 빠르고 저렴)
    ├─ system prompt: DB 스키마 + 현재 요약 통계 주입
    └─ tool use: Supabase 쿼리 실행 함수
        ↓
Supabase 조회 결과
    ↓
자연어 응답 → 대시보드 표시
```

---

## 구현 단계

### Phase 1 — API Route
파일: `dashboard/app/api/chat/route.ts`

- Claude API 호출 (Anthropic SDK)
- system prompt에 아래 컨텍스트 고정 주입:
  - artists/songs 테이블 스키마
  - 현재 전체 요약 (총 가수 수, 인스타율, 발송률 등)
- tool use 1개: `query_artists`
  - 파라미터: `filter` (상태), `date_from`, `date_to`, `group_by`
  - 내부에서 Supabase 쿼리 생성 후 결과 반환

### Phase 2 — UI
파일: `dashboard/components/ChatBot.tsx`

- 우하단 플로팅 버튼 (채팅 아이콘)
- 클릭 시 사이드 패널 슬라이드인
- 메시지 입력창 + 대화 히스토리
- 대시보드 어느 페이지에서든 사용 가능 (layout.tsx에 마운트)

### Phase 3 — 응답 형식
텍스트 응답 외에 구조화된 데이터도 렌더링:
- 숫자/비율 → 인라인 강조
- 목록 → 간단한 테이블
- 날짜별 추이 질문 → 미니 바 차트

---

## 지원할 질문 예시
- "이번 달 긍정 답장 몇 명이야?"
- "지난주에 수집된 가수 중 인스타 못 찾은 거 몇 개야?"
- "장르별로 가장 많이 수집된 순서 알려줘"
- "오늘 발송해야 할 가수 리스트 보여줘"
- "4월에 가장 수집 많았던 날 언제야?"
- "보류 처리한 가수 중 재연락일 지난 거 있어?"

---

## 기술 스택
- `@anthropic-ai/sdk` — Claude API
- 모델: `claude-haiku-4-5` (응답 속도, 비용 최적)
- tool use로 Supabase 직접 조회 (SQL 생성 X, 안전한 파라미터 쿼리)

---

## 환경변수 추가 필요
```
ANTHROPIC_API_KEY=sk-ant-...
```
서버사이드 전용 (NEXT_PUBLIC_ 붙이지 말 것)

---

## 구현 시점 권장 조건
- 가수 데이터 500명 이상 누적
- 발송/답장 사이클이 어느정도 돌아간 후 (통계 의미 있을 때)
- Vercel 배포 완료 후

---

## 예상 소요 시간
Phase 1 (API Route): 2~3시간
Phase 2 (UI): 3~4시간
Phase 3 (응답 형식): 1~2시간
총합: 약 1일
