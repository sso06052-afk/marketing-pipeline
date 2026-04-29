# 플랜: 웹 알림 + 디스코드 연동

## Context
파이프라인 실행 후 페이지를 떠나있거나 다른 탭에 있을 때 결과를 놓치지 않도록
브라우저 알림(Web Notification API)으로 완료 시점에 알려주는 기능.
나중에 Discord webhook으로 확장 예정.

---

## Phase 1 — 웹 알림 (브라우저 Notification API)

### 알림 발생 시점
1. 파이프라인 실행 완료 (성공/실패 모두)
2. 내용 예시: "파이프라인 완료 — 신규 15명, 인스타 확보 12명"

### 구현 방식
별도 서버/서비스 불필요. 프론트엔드 단독 처리.

**파일:** `dashboard/app/page.tsx`

1. 페이지 진입 시 알림 권한 요청
```ts
// 컴포넌트 마운트 시
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}
```

2. 파이프라인 완료 SSE 수신 시 (`payload.done`) 알림 발송
```ts
function sendNotification(title: string, body: string) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

// payload.done 수신 시
if (payload.done) {
  const ok = payload.code === 0;
  sendNotification(
    ok ? '파이프라인 완료' : '파이프라인 오류',
    ok ? `신규 ${payload.new_count}명 수집 완료` : `종료코드: ${payload.code}`
  );
}
```

3. SSE payload에 `new_count` 추가 필요
**파일:** `dashboard/app/api/pipeline/route.ts`
파이프라인 완료 시 `{ done: true, code: 0, new_count: N }` 형태로 전송

---

## Phase 2 — Discord Webhook 연동 (나중에)

### 구현 방식
서버사이드(API Route)에서 webhook 호출. 프론트 노출 없음.

**파일:** `dashboard/app/api/pipeline/route.ts`
파이프라인 완료 후:
```ts
await fetch(process.env.DISCORD_WEBHOOK_URL!, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: `✅ 파이프라인 완료\n신규 ${newCount}명 | 인스타 확보 ${instaCount}명`
  }),
});
```

**환경변수 추가:** `.env` / `.env.local`
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

---

## 수정 파일 목록

### Phase 1 (웹 알림)
| 파일 | 작업 |
|---|---|
| `dashboard/app/page.tsx` | 권한 요청 + Notification 발송 로직 추가 |
| `dashboard/app/api/pipeline/route.ts` | done payload에 `new_count` 추가 |

### Phase 2 (Discord)
| 파일 | 작업 |
|---|---|
| `dashboard/app/api/pipeline/route.ts` | Discord webhook POST 추가 |
| `.env` / `dashboard/.env.local` | `DISCORD_WEBHOOK_URL` 추가 |

---

## 검증 방법

### Phase 1
1. 대시보드 접속 시 브라우저 알림 권한 요청 팝업 뜨는지 확인
2. 파이프라인 실행 → 다른 탭으로 이동 → 완료 시 알림 뜨는지 확인
3. 알림 내용에 수집 인원 수 포함되는지 확인

### Phase 2
1. Discord 채널에서 webhook URL 발급
2. 파이프라인 실행 완료 후 Discord 채널에 메시지 수신 확인
