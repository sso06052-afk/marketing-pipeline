# 음원 홍보 파이프라인 — 설치 및 사용 가이드

> 멜론·지니 신곡에서 신규 가수를 자동 수집하고, 인스타그램 DM 발송과 답장 관리까지 한 곳에서 처리하는 시스템입니다.  
> 이 문서를 **위에서 아래로 순서대로** 따라하시면 설치가 완료됩니다.  
> 담당자와 통화하면서 진행하시는 걸 추천드립니다. (총 90~120분 소요)

---

## 📋 진행 순서 한눈에 보기

| 단계 | 내용 | 소요 시간 |
|---|---|---|
| **Phase 1** | 사전 준비 (파일 받기, 메모장 띄우기) | 5분 |
| **Phase 2** | API 키 발급 (Supabase·Gemini·Serper) | 30~40분 |
| **Phase 3** | Docker Desktop 설치 | 10~15분 |
| **Phase 4** | 환경변수 파일(.env) 만들기 | 10분 |
| **Phase 5** | 터미널 열고 폴더로 이동 | 5분 |
| **Phase 6** | Docker 이미지 빌드 | 10분 |
| **Phase 7** | 대시보드 실행 | 3분 |
| **Phase 8** | 동작 테스트 | 15분 |
| **Phase 9** | 일상 사용법 익히기 | 5분 |

---

## ⚠️ 시작 전 꼭 읽으세요

- 이 문서에서 받게 될 **API 키들은 비밀번호 같은 정보**입니다.  
  메일·카톡·슬랙·GitHub 등 어디에도 공유하면 안 됩니다.
- 작업 중 막히면 **에러 메시지 화면을 캡처**해서 담당자에게 보내주세요.
- 컴퓨터: **Mac (10.15 이상) / Windows 10·11** 만 지원
- 메모리 8GB 이상, 디스크 여유공간 10GB 이상 필요

---

# Phase 1 — 사전 준비 (5분)

## 1-1. 파일 받기

담당자가 보낸 **`marketing_pipeline.zip`** 파일을 받습니다.

1. 파일을 **바탕화면**으로 다운로드
2. 더블클릭해서 압축 해제
3. 바탕화면에 **`marketing_pipeline`** 폴더가 생기면 OK

> 폴더 이름 옆에 `-2` 같은 숫자가 붙으면 다른 위치에 같은 폴더가 또 있다는 뜻입니다. 그냥 진행해도 됩니다.

## 1-2. 메모장 띄워두기

키값을 정리할 메모장을 미리 열어둡니다.

- **Mac**: `Cmd + Space` → "TextEdit" → 엔터
- **Windows**: 시작 메뉴 → "메모장" → 엔터

이 메모장은 닫지 말고 계속 켜두세요. 곧 키 6개를 여기에 모을 겁니다.

---

# Phase 2 — API 키 발급 (30~40분)

이 시스템이 사용할 외부 서비스 3개에 가입합니다. **모두 무료로 시작 가능**합니다.

| 서비스 | 용도 | 무료 한도 |
|---|---|---|
| Supabase | DB (가수·곡 정보 저장) | 500MB |
| Gemini | AI 인스타 계정 판별 | 분당 15회 |
| Serper | 구글 검색 (인스타 탐색) | 2,500회 |

## 2-1. Supabase (DB) — 약 15분

### A. 회원가입

1. 브라우저에서 **`supabase.com`** 접속
2. 우측 상단 **Start your project** 클릭
3. **Continue with GitHub** 으로 로그인  
   → GitHub 계정 없으면 먼저 가입 (5~10분)

### B. 프로젝트 생성

1. **New project** 클릭
2. 정보 입력:
   - **Project name**: `marketing-pipeline`
   - **Database Password**: 강력한 비밀번호 설정 → **메모장에 적어두기**
   - **Region**: **Northeast Asia (Seoul)** 선택
   - **Pricing Plan**: **Free** 선택
3. **Create new project** 클릭
4. 1~2분 기다리면 프로젝트 준비 완료

### C. SQL 실행 (가장 중요한 단계)

DB에 테이블을 만들어주는 작업입니다.

1. 좌측 메뉴에서 **`</>`** 모양 아이콘 클릭 (SQL Editor)
2. **+ New query** 버튼 클릭 → 빈 화면이 뜸
3. 받으신 폴더에서 **`marketing_pipeline/supabase/schema.sql`** 파일 열기
   - **Mac**: 우클릭 → 다음으로 열기 → TextEdit
   - **Windows**: 우클릭 → 연결 프로그램 → 메모장
4. 파일 내용 **전체 선택**(`Cmd+A` / `Ctrl+A`) → **복사**(`Cmd+C` / `Ctrl+C`)
5. Supabase SQL Editor 화면에 **붙여넣기**(`Cmd+V` / `Ctrl+V`)
6. 우측 하단 **Run** 버튼 클릭 (또는 `Cmd+Enter` / `Ctrl+Enter`)
7. 화면 아래에 **`Success. No rows returned`** 라는 녹색 메시지가 뜨면 성공

> **에러가 나면?**
> - `relation "artists" already exists` → 이미 만들어진 거니 다음 단계로
> - `permission denied` → 새 query 다시 만들어서 처음부터 재실행
> - 그 외 → 에러 메시지 캡처 후 담당자에게 전달

8. 마이그레이션 파일도 추가 실행:
   - **+ New query** 다시 클릭
   - **`marketing_pipeline/supabase/migrations/20260429_add_deal_columns.sql`** 파일을 같은 방법으로 복사·붙여넣기·Run
   - 녹색 Success 뜨면 DB 셋업 완료

### D. 키 복사 (3개)

1. 좌측 메뉴 맨 아래 **톱니바퀴(⚙️)** 클릭 (Settings)
2. **API** 메뉴 클릭
3. 화면에 표시되는 값들을 메모장에 받아쓰기:

```
SUPABASE_URL=  여기에 'Project URL' 값 붙여넣기 (https://xxxxxxxxxxxxx.supabase.co)
SUPABASE_KEY=  여기에 'anon public' 키 붙여넣기 (eyJhbGc... 로 시작)
```

> **service_role secret** 키도 보이는데, 이건 비밀번호급 정보입니다.  
> **Reveal** 버튼 눌러서 일단 메모만 해두시고, 절대 외부 공유 금지.

```
SUPABASE_SERVICE_KEY=  service_role 키 (필요할 때만 사용)
```

## 2-2. Gemini API — 약 5분

### A. 가입 + 키 발급

1. 브라우저 새 탭에서 **`aistudio.google.com`** 접속
2. 우측 상단 **Sign in** → 구글 계정으로 로그인
3. 약관 동의 화면이 뜨면 모두 체크 후 진행
4. 좌측 메뉴 **Get API key** 클릭  
   *(또는 우측 상단 톱니바퀴 → API keys)*
5. **Create API key** → **Create API key in new project**
6. 키 표시되면 **Copy** 클릭 (`AIza...` 로 시작)

### B. 메모장에 추가

```
GEMINI_API_KEY=  복사한 키 붙여넣기 (AIzaSy...)
```

## 2-3. Serper API — 약 5분

### A. 가입 + 키 발급

1. 브라우저 새 탭에서 **`serper.dev`** 접속
2. 우측 상단 **Sign Up** → 구글 계정 또는 이메일로 가입
3. 가입 완료되면 자동으로 대시보드 이동
4. 좌측 메뉴 **API Key** 클릭
5. **Your API Key** 항목 복사

### B. 메모장에 추가

```
SERPER_API_KEY=  복사한 키 붙여넣기
```

> 가입 시 무료 검색 **2,500회** 제공 (1회성). 약 350명 가수 탐색 가능합니다.

## 2-4. 메모장 최종 정리

다음과 같이 **6줄**이 모여 있어야 합니다.

```
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SERPER_API_KEY=abcdef...
GEMINI_API_KEY=AIzaSy...
```

> **`NEXT_PUBLIC_SUPABASE_URL`** 값은 위의 `SUPABASE_URL` 값과 **똑같습니다.**  
> **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** 값은 위의 `SUPABASE_KEY` 값과 **똑같습니다.**  
> 같은 값을 4번이 아니라 2번 복사해서 4줄로 만드시면 됩니다.

---

# Phase 3 — Docker Desktop 설치 (10~15분)

> Docker는 이 프로그램을 실행하는 엔진입니다. **최초 1회만** 설치하면 됩니다.

## 3-1-A. Mac

1. 브라우저에서 **`docker.com/products/docker-desktop`** 접속
2. **Apple Chip** 인지 **Intel Chip** 인지 확인:
   - 화면 왼쪽 상단 **🍎 로고** 클릭 → **이 Mac에 관하여**
   - **칩(Chip): Apple M1/M2/M3** → Apple Chip 다운로드
   - **프로세서(Processor): Intel** → Intel Chip 다운로드
3. 다운받은 **`Docker.dmg`** 더블클릭
4. **Docker 아이콘을 Applications 폴더로 드래그**
5. Launchpad에서 **Docker** 실행 → 약관 **Accept**
6. 권한 묻는 창이 뜨면 컴퓨터 비밀번호 입력
7. **상단 메뉴바 오른쪽에 🐳 고래 아이콘**이 뜨면 완료

## 3-1-B. Windows

1. 브라우저에서 **`docker.com/products/docker-desktop`** 접속
2. **Windows** 다운로드 클릭
3. **`Docker Desktop Installer.exe`** 더블클릭
4. 설치 중 **`Use WSL 2 instead of Hyper-V`** 옵션 **체크된 채로** OK
5. 설치 완료 후 **Close and restart** → 컴퓨터 재시작
6. 시작 메뉴에서 **Docker Desktop** 실행 → 약관 **Accept**
7. **작업표시줄 우측 하단에 🐳 고래 아이콘**이 뜨면 완료

> **`WSL 2 installation is incomplete`** 오류 시:  
> 화면에 나오는 링크 클릭 → WSL2 업데이트 파일 다운로드 → 더블클릭 설치 → Docker 재실행

## 3-2. 실행 확인

🐳 고래 아이콘이 **움직이지 않고 가만히 있어야** 준비 완료입니다.  
움직이는 중이면 1~2분 더 기다리세요.

---

# Phase 4 — 환경변수 파일(.env) 만들기 (10분, 가장 중요)

이 단계가 제일 까다롭습니다. 천천히 따라하세요.

## 4-1-A. Mac

1. **Cmd + Space** → "TextEdit" 입력 → 엔터
2. 새 문서가 열리면 **Cmd + Shift + T** 누르기  
   → 화면이 'Plain Text' 모드로 바뀜 (이게 중요!)
   > 이미 일반 텍스트 모드면 메뉴 → Format → Make Plain Text 가 회색으로 표시됨
3. Phase 2-4에서 정리한 메모장 내용 **6줄 그대로** 복사해서 붙여넣기
4. **= 표시 앞뒤로 띄어쓰기 절대 금지, 따옴표 금지**
5. **Cmd + S** 로 저장창 띄우기
6. 저장 위치: **바탕화면 → marketing_pipeline 폴더**
7. 파일 이름: 그냥 **`.env`** 만 입력 (점으로 시작!)
8. 저장 누르면 경고창이 뜸 → **'점 사용(Use Dot)'** 클릭

## 4-1-B. Windows

1. 시작 메뉴 → "메모장" → 실행
2. Phase 2-4의 메모장 내용 **6줄 그대로** 복사해서 붙여넣기
3. **= 표시 앞뒤로 띄어쓰기 절대 금지, 따옴표 금지**
4. **Ctrl + S** 로 저장창 띄우기
5. 저장 위치: **바탕화면 → marketing_pipeline 폴더**
6. **파일 형식 드롭다운을 '모든 파일 (*.*)' 로 변경** ← 매우 중요
7. 파일 이름: **`.env`** (점으로 시작)
8. 저장

## 4-2. 파일 확인

`marketing_pipeline` 폴더 안에 **`.env`** 파일이 만들어졌는지 확인.

> **숨겨진 파일이라 안 보일 수 있어요:**
> - **Mac**: 폴더 안에서 `Cmd + Shift + .` (마침표)
> - **Windows**: 폴더 위쪽 '보기' → '숨긴 항목' 체크

> **`.env.txt` 처럼 `.txt`가 붙어있으면 안 됩니다!**  
> 파일 이름 변경(`F2`)으로 `.txt` 부분을 삭제하세요.

---

# Phase 5 — 터미널 열고 폴더 이동 (5분)

## 5-1-A. Mac

1. **Cmd + Space** → "터미널" 입력 → 엔터
2. 검은 창이 뜨면 키보드로 **`cd `** (cd 다음 한 칸 띄움) 입력 후 멈춤
3. Finder에서 **`marketing_pipeline` 폴더를 터미널 창으로 드래그**  
   → 폴더 경로가 자동으로 입력됨
4. 엔터
5. 확인: **`ls`** 입력 후 엔터 → **`Dockerfile`** 글자가 보이면 OK

## 5-1-B. Windows

1. 시작 메뉴 → "PowerShell" 검색 → 실행 (CMD 아닌 **PowerShell**)
2. 파란색 창이 뜨면 아래 입력:

```powershell
cd $HOME\Desktop\marketing_pipeline
```

3. 엔터
4. 확인: **`ls`** 입력 후 엔터 → **`Dockerfile`** 글자가 보이면 OK

---

# Phase 6 — Docker 이미지 빌드 (10분)

> 프로그램을 컴퓨터에 설치하는 단계. 5~10분 걸립니다. 터미널을 닫지 마세요.

## 6-1. 빌드 명령어 입력

메모장에서 **`NEXT_PUBLIC_SUPABASE_URL`** 값과 **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** 값을 미리 복사해두세요.

### Mac

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=여기에_URL_붙여넣기 \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_KEY_붙여넣기 \
  -t marketing-pipeline .
```

### Windows (PowerShell)

```powershell
docker build `
  --build-arg NEXT_PUBLIC_SUPABASE_URL=여기에_URL_붙여넣기 `
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_KEY_붙여넣기 `
  -t marketing-pipeline .
```

> **주의:**
> - **`여기에_URL_붙여넣기`** 부분을 실제 값으로 교체
> - 마지막 줄 끝의 **점(`.`)** 빠뜨리면 안 됨
> - Mac은 백슬래시 `\`, Windows는 백틱 `` ` `` 차이 주의

엔터 누르면 글자가 와르르 올라갑니다. 5~10분 후 **`Successfully tagged marketing-pipeline`** 같은 메시지가 나오면 완료.

## 6-2. 빌드 실패 시

| 오류 메시지 | 해결 |
|---|---|
| `Cannot connect to Docker daemon` | Docker Desktop 실행 확인 (🐳 아이콘) |
| `failed to solve` | 인터넷 연결 확인 후 같은 명령어 다시 실행 |
| `unauthorized` | 같은 명령어 다시 실행 (간헐적 오류) |
| `no space left on device` | Docker Desktop 설정 → Resources → Disk image size 늘리기 |

---

# Phase 7 — 대시보드 실행 (3분)

## 7-1. 컨테이너 실행

빌드가 끝났으면 한 줄짜리 명령어로 프로그램을 켭니다.

### Mac

```bash
docker run -d --name pipeline-dashboard -p 3000:3000 -v $(pwd)/.env:/app/.env --restart unless-stopped marketing-pipeline
```

### Windows (PowerShell)

```powershell
docker run -d --name pipeline-dashboard -p 3000:3000 -v "${PWD}/.env:/app/.env" --restart unless-stopped marketing-pipeline
```

엔터 누르면 영어로 된 길쭉한 문자열이 나옵니다. → 정상.

## 7-2. 브라우저 접속

브라우저 새 창에서 **`http://localhost:3000`** 접속

→ **음원 홍보 대시보드** 화면이 뜨고, 도넛 차트 3개가 보이면 ✅ 설치 성공!

> **`This site can't be reached`** 오류 시:  
> 30초 기다리고 새로고침. (Next.js 첫 시작이 느립니다)
>
> 그래도 안 되면 터미널에서:
> ```bash
> docker logs pipeline-dashboard
> ```
> 출력 결과 캡처해서 담당자에게 전달

---

# Phase 8 — 동작 테스트 (15분)

## 8-1. 첫 수집 테스트

1. 대시보드 우측 상단 **소스 토글**에서 **지니** 선택
2. 페이지 수 **`1p`** 선택
3. **▶ 지니 1p 실행** 버튼 클릭
4. 검은 로그 창이 열리고 진행 상황이 표시됨
5. **`=== 완료 ===`** 라는 줄이 나오면 끝 (1~2분)

## 8-2. 결과 확인

- **발송대기** 탭에 가수들이 쭉 나타남 (보통 10~30명)
- 도넛 차트가 채워짐
- **인스타 확보율** 60~80% 정도면 정상

## 8-3. 가수 카드 클릭

1. 아무 가수 행 클릭
2. 우측에서 슬라이드 패널이 열림
3. 가수명, 곡명, 인스타 핸들, 신뢰도 점수 확인
4. **X** 버튼으로 패널 닫기

## 8-4. DM 발송 테스트 (실제 발송 X)

> 인스타그램 창이 열리고 인사 문구가 클립보드에 복사되는지만 확인합니다. **실제 메시지는 보내지 않습니다.**

1. 행 옆 **DM** 버튼(파란색) 클릭
2. 새 탭에 인스타 DM 창이 열림
3. **DM 발송 완료** 토스트 알림 표시
4. 그 행이 회색으로 변하고 **재DM** 으로 변경
5. **발송완료** 탭에 한 명 추가됨

→ 인스타 창은 그냥 닫으면 됩니다.

## 8-5. 검토필요 탭 확인

**검토필요** 탭 클릭 → 인스타를 못 찾은 가수들이 카드로 보임.  
나중에 사용 시 직접 핸들 입력해서 저장하는 곳입니다.

## 8-6. 날짜 이동 테스트

화면 가운데 **`오늘 · 2026-04-29`** 같은 날짜 버튼:
- **← →** 화살표: 어제/오늘 이동
- 날짜 텍스트 클릭: 달력 팝업

---

# Phase 9 — 일상 사용법 (5분)

## 9-1. 매일 사용 흐름

1. **Docker Desktop 실행 확인** (🐳 아이콘)
2. 브라우저에서 **`localhost:3000`** 접속
3. 우측 상단 **▶ 실행** 버튼으로 신곡 수집 (1~2분)
4. **발송대기** 탭에서 가수 확인
5. **DM** 버튼 클릭 → 인스타에서 메시지 발송
6. 답장 오면 가수 행 클릭 → 패널에서 **답장완료** + 결과(긍정/거절/보류)

## 9-2. 컴퓨터 재시작 후

자동으로 다시 켜지게 설정되어 있습니다. Docker Desktop만 켜져 있으면 됩니다.

안 켜졌으면 터미널에서:
```bash
docker start pipeline-dashboard
```

## 9-3. 메모·재연락·계약 관리

가수 패널에서:
- **📝 메모**: 통화·협상 내용 기록
- **🔁 재연락**: 다시 연락할 날짜 설정
- **계약 진행중 / 완료**: 계약 단계 추적

→ 모두 통계로 자동 집계됩니다.

## 9-4. 통계 보기

상단 네비게이션에서 **DB 관리** 클릭 → **통계 탭**:
- 인스타 출처별 분포
- 장르별 분포
- 14일간 수집 추이
- **계약 성사율**

---

# 🎉 설치 완료 체크리스트

- [ ] Docker Desktop 실행 중 (🐳 아이콘)
- [ ] 브라우저 `localhost:3000` 접속 가능
- [ ] **▶ 실행** 으로 수집 동작 확인
- [ ] **발송대기** 탭에 가수 보임
- [ ] **DM** 버튼 클릭 시 인스타 창 열림
- [ ] `.env` 파일이 marketing_pipeline 폴더 안에 존재

---

# 📌 자주 쓰는 명령어

```bash
# 대시보드 켜기
docker start pipeline-dashboard

# 대시보드 끄기
docker stop pipeline-dashboard

# 상태 확인
docker ps

# 로그 보기 (문제 생겼을 때)
docker logs pipeline-dashboard
```

---

# ❓ 자주 묻는 질문

**Q. 매일 컴퓨터를 켜둬야 하나요?**  
A. 사용할 때만 켜시면 됩니다. 24시간 자동 운영을 원하시면 별도 서버 배포 필요(담당자 문의).

**Q. 인스타 핸들이 잘못 들어왔어요**  
A. 가수 행 클릭 → 패널에서 인스타 핸들 직접 수정 가능.

**Q. 한 가수에게 여러 번 DM 보내도 되나요?**  
A. 네. 발송 횟수가 자동 기록되며, 2번째부터 **2차DM** 으로 표시됩니다.

**Q. 다른 사람과 데이터 공유가 되나요?**  
A. 데이터는 클라우드(Supabase)에 저장됩니다. 다른 컴퓨터에 같은 방법으로 설치하면 같은 데이터를 봅니다. 단, **동시에 두 곳에서 수집을 돌리지 마세요** (중복 발생).

**Q. 프로그램이 안 켜져요**  
A. 1) Docker Desktop 실행 확인 → 2) `docker start pipeline-dashboard` → 3) 그래도 안 되면 담당자 연락.

**Q. 새 버전을 받았어요**  
A. 받은 폴더로 기존 폴더 덮어쓰기 → 터미널에서:
```bash
docker rm -f pipeline-dashboard
# Phase 6 빌드 다시
# Phase 7 실행 다시
```

**Q. Serper 무료 2,500회를 다 썼어요**  
A. 1) 유료 결제 (월 $50) / 2) 새 이메일로 재가입 / 3) 담당자 문의

**Q. API 키가 유출된 것 같아요**  
A. 즉시 담당자 연락 + 해당 서비스에서 키 재발급:
- Supabase: Settings → API → Reset
- Gemini: aistudio.google.com → API keys → 삭제 후 재생성
- Serper: serper.dev → API Key → 재생성

---

# 📞 문의

설치·사용 중 문제가 생기면 담당자에게 연락하세요.  
오류 메시지는 **스크린샷 + `docker logs pipeline-dashboard` 결과**를 함께 보내주시면 빠르게 해결됩니다.
