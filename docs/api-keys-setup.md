# API 키 발급 가이드

> 이 시스템을 처음 사용하려면 아래 3가지 서비스에 가입하고 키를 발급받아야 합니다.  
> 모두 **무료 플랜**으로 시작 가능합니다.  
> 소요 시간: 약 **30~40분**

---

## 발급해야 하는 키 목록

| 서비스 | 용도 | 무료 한도 | 필수 여부 |
|---|---|---|---|
| **Supabase** | 데이터베이스 (가수·곡 정보 저장) | 500MB DB, 무제한 요청 | 필수 |
| **Gemini** | AI 인스타그램 계정 판별 | 분당 15회 (충분) | 필수 |
| **Serper** | 구글 검색 (인스타 탐색) | 월 2,500회 | 필수 |

---

# 1️⃣ Supabase (데이터베이스)

가수 정보, 발송 기록, 답장 결과 등 모든 데이터가 여기에 저장됩니다.

## 1-1. 회원가입

1. 브라우저에서 **`supabase.com`** 접속
2. 우측 상단 **Start your project** 클릭
3. **GitHub** 계정으로 로그인 (없으면 GitHub 가입 먼저)

## 1-2. 프로젝트 생성

1. 로그인 후 **New project** 클릭
2. 정보 입력:
   - **Project name**: `marketing-pipeline` (자유롭게)
   - **Database Password**: 강력한 비밀번호 설정 (메모해두기)
   - **Region**: **Northeast Asia (Seoul)** 선택 (한국에서 빠름)
   - **Pricing Plan**: **Free** 선택
3. **Create new project** 클릭
4. 약 1~2분 기다리면 프로젝트 준비 완료

## 1-3. DB 스키마 생성 (가장 중요)

1. 좌측 메뉴에서 **SQL Editor** 아이콘 클릭 (`</>` 모양)
2. **New query** 클릭
3. 받으신 파일에서 **`marketing_pipeline/supabase/schema.sql`** 파일을 메모장으로 열기
4. 파일 내용 **전체 복사** (Cmd+A → Cmd+C / Ctrl+A → Ctrl+C)
5. SQL Editor 화면에 붙여넣기
6. 우측 하단 **Run** 버튼 클릭 (또는 Cmd/Ctrl + Enter)
7. 화면 아래에 **Success. No rows returned** 메시지가 나오면 완료

> **에러가 나면**: 메시지를 캡처해서 담당자에게 전달

8. **마이그레이션도 추가 실행:**
   - 다시 **New query** 클릭
   - **`marketing_pipeline/supabase/migrations/20260429_add_deal_columns.sql`** 파일 내용 복사·붙여넣기
   - **Run** 클릭

## 1-4. 키 복사

1. 좌측 메뉴 맨 아래 **Settings (⚙️)** 클릭
2. **API** 메뉴 클릭
3. 아래 3개 값을 **메모장에 복사**:

```
Project URL                 → SUPABASE_URL 에 사용
                              (예: https://abcdefgh.supabase.co)

Project API keys
  ├─ anon public            → SUPABASE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY 에 사용
  │                           (긴 eyJ... 로 시작하는 문자열)
  └─ service_role secret    → SUPABASE_SERVICE_KEY 에 사용
                              ⚠️ 이건 비공개 키 — 절대 외부 공유 금지
```

> **service_role 키 보는 법**: "Reveal" 버튼을 눌러야 보입니다.

## 1-5. 완료 — 메모해둘 것

```
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGc... (anon public 키)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... (위와 동일)
SUPABASE_SERVICE_KEY=eyJhbGc... (service_role 키)
```

---

# 2️⃣ Gemini API (AI 판별)

인스타그램 계정 후보 중 가수 본인 계정을 AI가 판별합니다.

## 2-1. 회원가입

1. 브라우저에서 **`aistudio.google.com`** 접속
2. 우측 상단 **Sign in** → 구글 계정으로 로그인
3. 약관 동의 화면이 뜨면 모두 체크 후 진행

## 2-2. API 키 발급

1. 로그인 후 좌측 메뉴에서 **Get API key** 클릭  
   *(또는 우측 상단 톱니바퀴 → API keys)*
2. **Create API key** 버튼 클릭
3. **Create API key in new project** 선택
4. 생성된 키가 화면에 표시됨 (`AIza...` 로 시작하는 문자열)
5. **Copy** 버튼으로 복사 → 메모장에 저장

## 2-3. 완료 — 메모해둘 것

```
GEMINI_API_KEY=AIzaSy...
```

> **참고**: Gemini 무료 플랜은 분당 15회 호출 제한이 있지만, 평소 사용량으로는 충분합니다.

---

# 3️⃣ Serper API (구글 검색)

인스타그램 계정을 구글 검색으로 찾을 때 사용합니다.

## 3-1. 회원가입

1. 브라우저에서 **`serper.dev`** 접속
2. 우측 상단 **Sign Up** 클릭
3. 구글 계정 또는 이메일로 회원가입

## 3-2. API 키 확인

1. 가입 완료 후 자동으로 대시보드로 이동
2. 좌측 메뉴 **API Key** 클릭
3. 화면에 표시된 **Your API Key** 복사 → 메모장에 저장

## 3-3. 무료 크레딧

- 가입 시 **2,500회 무료 검색** 제공 (월 갱신 없음, 1회성)
- 약 350명의 가수 탐색 가능
- 소진 시 유료 플랜 결제 또는 새 계정 생성 필요

## 3-4. 완료 — 메모해둘 것

```
SERPER_API_KEY=abcdef1234567890...
```

---

# 4️⃣ 모든 키 모으기 (.env 파일 작성용)

위 3개 서비스에서 받은 값을 모두 모아 정리합니다.

```
─────────────────────────────────────────────
.env 파일에 들어갈 값 (총 6줄)

SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SERPER_API_KEY=abcdef...
GEMINI_API_KEY=AIzaSy...

* SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL 같은 값
* SUPABASE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY 같은 값
─────────────────────────────────────────────
```

> 참고: `SUPABASE_SERVICE_KEY` 는 dashboard 폴더 안에서 별도로 관리되며, 현재 구성에서는 .env에 안 넣어도 됩니다. 만약 사용한다면:
> ```
> SUPABASE_SERVICE_KEY=eyJhbGc... (service_role 키)
> ```

---

# ⚠️ 보안 주의사항

- **`.env` 파일과 키 메모는 외부에 절대 공유하지 마세요**
  - 메일 첨부, 슬랙, 카톡, GitHub 모두 금지
  - 화면 공유 시 가림막 사용
- 키가 유출되면:
  1. **Supabase**: 프로젝트 Settings → API → "Reset" 으로 키 재발급
  2. **Gemini**: aistudio.google.com → API keys → 기존 키 삭제 후 재생성
  3. **Serper**: serper.dev → API Key 메뉴에서 재생성

---

# 자주 묻는 질문

**Q. 무료 플랜으로 얼마나 쓸 수 있나요?**
- Supabase: DB 500MB까지 — 가수 약 50,000명 분량
- Gemini: 분당 15회 — 일 수백명 처리 가능
- Serper: 2,500회 (1회성) — 약 350명 가수 탐색 후 소진

**Q. Serper 무료가 끝나면 어떻게 하나요?**
- A안: 유료 결제 (월 50달러부터)
- B안: 새 이메일로 다시 가입
- C안: 담당자에게 문의

**Q. Gemini 키가 작동 안 해요**
- 발급 후 1~2분 기다린 후 다시 시도
- 그래도 안 되면 새 키 재발급

**Q. Supabase에서 SQL 실행 시 에러가 나요**
- 에러 메시지 캡처 → 담당자에게 전달
- 보통 schema.sql을 부분 실행했거나 순서가 꼬인 경우입니다

---

# 다음 단계

키 발급이 모두 끝났으면:

→ **[설치 가이드 (client-setup-guide.md)](client-setup-guide.md)** 의 STEP 2 (`.env` 파일 생성)부터 진행하세요.
