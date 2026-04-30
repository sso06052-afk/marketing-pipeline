# 전화 통화 안내 스크립트 — 설치부터 테스트까지 E2E

> 이 문서는 담당자(나)가 고객사에 전화하며 보는 가이드입니다.  
> 처음부터 끝까지 약 **90~120분** 소요.  
> 고객사는 같은 순서로 정리된 README.md 를 보면서 따라옵니다.

---

## 통화 시작 전 체크리스트 (담당자)

- [ ] 고객사 컴퓨터가 Mac인지 Windows인지 확인
- [ ] 받는 사람 이름·직책 확인
- [ ] GitHub 레포 public 여부 확인 (`https://github.com/sso06052-afk/marketing-pipeline`)
- [ ] 본 문서 (이 화면) 띄워두기

### 고객사가 받게 될 키 6개 (참고용)

```
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...(anon public 키)
NEXT_PUBLIC_SUPABASE_URL=(위 SUPABASE_URL과 동일)
NEXT_PUBLIC_SUPABASE_ANON_KEY=(위 SUPABASE_KEY와 동일)
SERPER_API_KEY=...
GEMINI_API_KEY=...
```

---

# Phase 1 — Git 설치 + 코드 받기 (10분)

## 통화 시작 멘트

> "안녕하세요, 음원 홍보 파이프라인 설치 도와드리려고 연락드렸습니다.  
> 시간은 두 시간 정도 걸릴 거고요, 중간에 중단해도 되니까 부담 없이 진행하시면 됩니다.  
> 먼저 컴퓨터가 Mac이세요, Windows세요?"

→ 답변에 따라 아래 분기

> "그리고 진행 중에 똑같은 단계 적힌 README 문서를 보내드릴 텐데, 같이 보면서 진행하시면 편하실 거예요. 일단 GitHub 레포 주소 보내드릴게요. **github.com/sso06052-afk/marketing-pipeline**"

## 1-1. Git 설치

> "처음에 Git이라는 도구 하나만 설치하실 건데요, 이게 코드를 받고 나중에 업데이트할 때 쓰는 도구입니다."

### Mac (이미 설치되어 있는 경우 많음)

> "**Cmd + Space** 눌러서 Spotlight 띄우시고, '터미널' 입력 후 엔터해주세요."

> "검은 창 뜨면 **`git --version`** 입력하고 엔터."

→ 결과별 분기:
- **`git version 2.x.x`** 같이 버전 나옴 → "이미 설치되어 있어요! 다음 단계로 갑니다."
- **설치 안내 창이 뜸** → "**Install** 버튼 클릭하세요. 5분 정도 자동 설치됩니다."

### Windows (직접 설치 필요)

> "브라우저에서 **`git-scm.com/download/win`** 들어가주세요."

> "**64-bit Git for Windows Setup** 버튼 누르면 다운로드됩니다."

> "다운받은 .exe 파일 더블클릭하시고요, 설치 화면에서 **모든 옵션 기본값 그대로 두고 Next 계속 눌러주세요.** 마지막에 Install 클릭하면 1분 정도 후 완료됩니다."

> "설치 끝나면 시작 메뉴에서 **PowerShell** 검색해서 실행해주세요. CMD 말고 반드시 PowerShell이에요."

> "파란색 창 뜨면 **`git --version`** 입력하고 엔터. **`git version 2.x.x`** 같은 게 나오면 OK."

## 1-2. 메모장 띄우기

> "메모장 하나 띄워두세요. (Mac은 텍스트 편집기, Windows는 메모장)  
> 이따 받으실 키값들을 여기에 정리할 거예요. 이 메모장은 끝까지 닫지 마세요."

## 1-3. 프로젝트 코드 받기

> "이제 GitHub에서 코드를 받을 거예요. 이미 열려있는 터미널/PowerShell에서 진행합니다."

### Mac

```bash
cd ~/Desktop
git clone https://github.com/sso06052-afk/marketing-pipeline.git
```

### Windows

```powershell
cd $HOME\Desktop
git clone https://github.com/sso06052-afk/marketing-pipeline.git
```

> "엔터 누르면 다운로드 진행 표시가 나오고, 1분 안에 끝납니다."

> "바탕화면에 **marketing-pipeline** (하이픈) 폴더 보이시나요? `_` 언더바 아니고 `-` 하이픈이에요."

→ 보이면 OK, Phase 2로

---

# Phase 2 — API 키 발급 (30~40분)

> "이제 이 시스템이 사용할 외부 서비스 3개에 가입하실 거예요.  
> 모두 무료로 시작 가능합니다."

## 2-1. Supabase (DB) — 약 15분

### 2-1-A. 회원가입

> "브라우저에서 **supabase.com** 들어가주세요.  
> 우측 상단 **Start your project** 버튼 클릭하시고요.  
> **Continue with GitHub**으로 로그인하세요. GitHub 계정 없으면 잠깐 만들고 와주세요."

> *(GitHub 가입이 필요하면 5~10분 추가)*

### 2-1-B. 프로젝트 생성

> "로그인 되시면 **New project** 버튼 누르세요. 화면에 정보 입력란이 뜰 거예요."

> "**Project name**은 marketing-pipeline 이라고 입력하시고요.  
> **Database Password**는 **강력한 비밀번호**를 만들어주세요. 메모장에 적어두세요. 나중에 거의 안 쓰지만 분실하면 곤란해요."

> "**Region**은 **Northeast Asia (Seoul)** 선택하세요. 한국에 가까운 서버라 빠릅니다."

> "**Pricing Plan**은 **Free** 선택. **Create new project** 누르세요."

> "프로젝트 생성에 1~2분 걸립니다. 화면 가운데 로딩 스피너 돌면서 기다리시면 돼요."

### 2-1-C. SQL 실행 (가장 중요한 단계)

> "프로젝트 만들어졌으면 좌측 메뉴에 아이콘들이 쭉 있을 거예요.  
> 그 중에 **`</>` 모양 아이콘** (SQL Editor) 클릭해주세요."

> "**+ New query** 버튼 누르시고요. 빈 화면이 뜰 거예요."

> "이제 받으신 폴더에서 SQL 파일을 열 거예요.  
> **marketing-pipeline → supabase → schema.sql** 파일 찾아주세요."

**Mac:**
> "파일을 우클릭 → **다음으로 열기** → **TextEdit** 으로 열어주세요."

**Windows:**
> "파일을 우클릭 → **연결 프로그램** → **메모장** 으로 열어주세요."

> "파일이 열리면 **Cmd+A (Mac) / Ctrl+A (Win)** 으로 전체 선택하시고  
> **Cmd+C / Ctrl+C** 로 복사하세요."

> "다시 Supabase SQL Editor 화면으로 돌아가서 빈 칸에 붙여넣기(Cmd+V / Ctrl+V) 하세요."

> "코드가 쭉 붙으면 우측 하단 **Run** 버튼 누르세요. 또는 **Cmd+Enter / Ctrl+Enter**."

> "잠깐 처리하고 화면 아래에 **'Success. No rows returned'** 라고 녹색 메시지가 뜨면 성공입니다."

→ **에러 발생 시 대응:**
- `relation "artists" already exists`: 이전 실행으로 이미 만들어진 거. 정상이니 다음 단계로
- `permission denied`: 새 query 다시 만들어서 처음부터 재실행
- 그 외 에러: 메시지 캡처해서 담당자(나)에게 보내달라고 요청

> "이제 마이그레이션 파일도 한 번 더 실행할게요.  
> SQL Editor에서 **+ New query** 다시 누르시고요."

> "이번엔 **marketing-pipeline → supabase → migrations → 20260429_add_deal_columns.sql** 파일을 같은 방법으로 열어서 전체 복사·붙여넣기·Run 하세요."

> "녹색 Success 뜨면 DB 셋업 완료입니다."

### 2-1-D. 키 복사 (3개)

> "이제 만든 DB의 접속 정보를 가져올 거예요."

> "좌측 메뉴 맨 아래 **톱니바퀴 아이콘 (Settings)** 누르세요.  
> 그 안에 메뉴들 중 **API** 클릭."

> "화면에 정보가 쭉 나올 거예요. 메모장에 받아쓰세요."

**1번: Project URL**
> "**Project URL** 항목 복사해서 메모장에 적어주세요. **`https://xxxxxxxxxxxxx.supabase.co`** 형식이에요."

**2번: anon public 키**
> "조금 아래로 스크롤하면 **Project API keys** 섹션이 있어요.  
> **anon public** 줄의 긴 문자열을 복사해주세요. **`eyJhbGc...`** 로 시작합니다."

**3번 (선택): service_role 키**
> "그 아래에 **service_role secret** 항목이 있어요.  
> **'Reveal'** 또는 눈 아이콘 누르시면 키가 보입니다.  
> 이건 비밀번호급으로 중요하니까 절대 외부 공유하지 마세요. 일단 메모만 해두세요."

→ 메모장 상태 확인:
```
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGc... (anon public)
SUPABASE_SERVICE_KEY=eyJhbGc... (service_role)
```

## 2-2. Gemini API — 약 5분

> "이제 두 번째 서비스인 Gemini로 넘어갈게요. AI 판별용입니다."

> "브라우저 새 탭에서 **aistudio.google.com** 들어가주세요.  
> 우측 상단 **Sign in** → 본인 구글 계정으로 로그인."

> "약관 동의 화면 뜨면 모두 체크하시고 진행."

> "로그인 되면 좌측 메뉴에서 **Get API key** 버튼 찾아 클릭해주세요.  
> 안 보이면 우측 상단 톱니바퀴 → **API keys** 메뉴로도 갈 수 있어요."

> "**Create API key** 버튼 누르시고, **Create API key in new project** 선택."

> "키가 화면에 표시되면 **`AIza...`** 로 시작하는 문자열이에요. **Copy** 버튼으로 복사해서 메모장에 추가하세요."

→ 메모장 상태:
```
GEMINI_API_KEY=AIzaSy...
```

## 2-3. Serper API — 약 5분

> "마지막입니다. 구글 검색용 서비스예요."

> "브라우저 새 탭에서 **serper.dev** 들어가주세요.  
> 우측 상단 **Sign Up** → 구글 계정 또는 이메일로 가입."

> "가입 끝나면 자동으로 대시보드로 이동할 거예요.  
> 좌측 메뉴에서 **API Key** 클릭."

> "**Your API Key** 항목에 키가 보일 거예요. 복사해서 메모장에 추가하세요."

> "참고로 가입 시 무료 검색 2,500회를 줍니다. 약 350명 가수 탐색 가능한 양이에요. 다 쓰면 다시 알려드릴게요."

→ 메모장 최종 상태:
```
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGc...
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co (위 URL과 동일)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... (위 KEY와 동일)
SERPER_API_KEY=abcdef...
GEMINI_API_KEY=AIzaSy...
```

> "이제 모든 키 발급 완료되셨어요. 이 메모 파일은 잃어버리지 마세요!"

---

# Phase 3 — Docker Desktop 설치 (10~15분)

## 3-1. Docker가 뭔지 간단 설명

> "Docker는 이 프로그램을 실행하는 엔진이에요.  
> 한 번만 설치하면 되고, 평소엔 신경쓰지 않으셔도 됩니다."

## 3-2-A. Mac 설치

> "브라우저 열어서 주소창에 **docker.com/products/docker-desktop** 입력해주세요."

→ 페이지 열리면

> "Mac용 다운로드 버튼이 보이실 거예요. **Apple Chip**이랑 **Intel Chip** 두 개 중에 골라야 하는데요,  
> 화면 왼쪽 위에 사과 모양 로고 클릭하시고 **'이 Mac에 관하여'** 눌러보세요."

→ 답변에 따라
- **칩(Chip)**: Apple M1/M2/M3 → "Apple Chip 받으세요"
- **프로세서(Processor)**: Intel → "Intel Chip 받으세요"

> "다운로드 다 되면 다운로드 폴더에서 **Docker.dmg** 파일 더블클릭해주세요.  
> 창이 하나 뜨는데, 거기 보이는 **Docker 아이콘을 Applications 폴더로 드래그**하시면 됩니다."

→ 드래그 후

> "Launchpad나 Applications 폴더에서 **Docker** 찾아서 실행해주세요.  
> 처음에 약관 동의 창 뜨면 **Accept** 누르시고요."

> "권한 묻는 창이 뜨면 컴퓨터 비밀번호 입력해주세요."

> "**화면 맨 위 메뉴바 오른쪽에 고래 아이콘이 떴나요?** 떴으면 설치 완료입니다."

## 3-2-B. Windows 설치

> "브라우저 열어서 **docker.com/products/docker-desktop** 들어가주세요."

> "**Windows** 다운로드 버튼 누르시면 됩니다."

> "다운로드 끝나면 **Docker Desktop Installer.exe** 더블클릭해주세요."

> "설치 중에 옵션 두 개 보일 텐데요,  
> **'Use WSL 2 instead of Hyper-V'** 라는 거 **체크된 채로** 두시고 OK 누르세요."

> "설치 끝나고 **Close and restart** 버튼 뜨면 누르세요. 컴퓨터가 재시작됩니다."

→ 재시작 후

> "재시작 끝났으면 시작 메뉴에서 **Docker Desktop** 찾아서 실행해주세요.  
> 약관 뜨면 Accept 눌러주시고요."

> "**'WSL 2 installation is incomplete'** 같은 오류가 뜨면, 화면에 나오는 링크 클릭해서 업데이트 파일 받으세요. 다운로드 다 되면 더블클릭해서 설치하시고 Docker 다시 실행하시면 됩니다."

> "**작업표시줄 오른쪽 아래에 고래 아이콘 떴나요?** 떴으면 완료입니다."

## 3-3. Docker 실행 확인

> "고래 아이콘이 **움직이지 않고 가만히** 있어야 준비 완료예요.  
> 움직이고 있으면 1~2분 더 기다려주세요."

---

# Phase 4 — 환경변수 파일 만들기 (10분, 가장 중요한 단계)

## 4-1. 사전 안내

> "이제 방금 발급받으신 API 키들을 프로그램에 알려주는 파일을 하나 만들 거예요.  
> 이게 좀 까다로운데, 천천히 따라오시면 됩니다."

## 4-2-A. Mac에서 .env 파일 만들기

> "**Spotlight 열어주세요. Cmd 키랑 Space 키 같이 누르시면 돼요.**  
> 'TextEdit' 입력하시고 엔터."

> "텍스트 편집기가 열리면 **Cmd + Shift + T**를 눌러주세요.  
> 그러면 위쪽 메뉴바 보시면 화면이 'Plain Text' 모드로 바뀌어요. 이게 중요합니다."

> "메뉴 → Format → Make Plain Text 가 회색이면 이미 일반 텍스트 모드예요. OK입니다."

> "이제 메모장에 정리해두신 6줄을 그대로 복사해서 붙여넣으세요."

→ 받아쓰게 하기:
```
SUPABASE_URL=
SUPABASE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SERPER_API_KEY=
GEMINI_API_KEY=
```

> "각 줄의 = 표시 뒤에 메모장에 적어둔 키값을 복사해서 붙여넣으세요.  
> **= 앞뒤로 띄어쓰기 절대 넣지 마세요.** 따옴표도 넣으면 안 됩니다."

> "다 됐으면 **Cmd + S** 눌러서 저장창 띄우시고요."

> "저장 위치를 **바탕화면 → marketing-pipeline 폴더**로 들어가세요."

> "파일 이름란에 그냥 **.env** 라고만 쓰세요. 점으로 시작하는 거 맞습니다."

> "저장 누르면 '점으로 시작하는 파일은 시스템 파일' 어쩌고 경고 뜰 텐데요, **'점 사용(Use Dot)'** 누르시면 됩니다."

## 4-2-B. Windows에서 .env 파일 만들기

> "시작 메뉴에서 **메모장** 검색해서 실행해주세요."

→ 받아쓰게 하기 (위 Mac과 동일):
```
SUPABASE_URL=
SUPABASE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SERPER_API_KEY=
GEMINI_API_KEY=
```

> "**= 표시 뒤에** 메모장에 적어둔 키값을 복사해서 붙여넣으세요.  
> 등호 앞뒤 띄어쓰기, 따옴표 절대 넣으면 안 됩니다."

> "다 됐으면 **Ctrl + S** 누르시고요."

> "저장 위치를 **바탕화면 → marketing-pipeline 폴더** 안으로 들어가세요."

> "파일 형식 드롭다운을 **'모든 파일 (*.*)'** 로 바꿔주세요. 이게 중요해요."

> "파일 이름에 **.env** (점부터 시작) 입력하고 저장 누르세요."

## 4-3. 파일 확인

> "**파일이 잘 만들어졌는지 확인할게요.**  
> 폴더 안에 .env 파일이 보이시나요?"

**Mac:**
> "안 보이시면 폴더 안에서 **Cmd + Shift + .** (마침표) 누르세요. 숨김파일이 보입니다."

**Windows:**
> "안 보이시면 폴더 위쪽 **'보기'** 메뉴에서 **'숨긴 항목'** 체크하세요."

> "**.env.txt 같이 .txt로 끝나면 안 됩니다.** 정확히 .env 만 있어야 해요.  
> .txt가 붙었으면 파일 이름 변경(F2) 해서 .txt 부분 삭제하세요."

---

# Phase 5 — 터미널 열고 폴더 이동 (5분)

## 5-1. Mac

> "터미널 이미 열려있죠? 거기에 명령어 한 줄 입력하실 거예요."

```bash
cd ~/Desktop/marketing-pipeline
```

> "엔터 누르시고요. 그다음 **ls** 입력하고 엔터. **Dockerfile** 글자 보이시나요?"

→ 보이면 OK. 안 보이면 폴더 잘못 들어간 거.

## 5-2. Windows

> "PowerShell 이미 열려있죠? 거기에 입력해주세요."

```powershell
cd $HOME\Desktop\marketing-pipeline
```

> "그다음 **ls** 입력하고 엔터. **Dockerfile** 보이시면 OK입니다."

---

# Phase 6 — Docker 이미지 빌드 (10분)

## 6-1. 빌드 명령어 실행

> "이제 프로그램을 컴퓨터에 설치할 거예요.  
> 한 번만 하면 됩니다. 5~10분 걸립니다."

> "메모장에 적어두신 **NEXT_PUBLIC_SUPABASE_URL** 값을 복사해두세요.  
> 그다음 **NEXT_PUBLIC_SUPABASE_ANON_KEY** 값도요."

**Mac:**
> "터미널에 아래 명령어 입력하실 건데요, 제가 부르면서 받아쓰세요.  
> 줄바꿈은 백슬래시(\\) 다음 엔터로 표시됩니다."

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=여기에붙여넣기1 \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에붙여넣기2 \
  -t marketing-pipeline .
```

**Windows (PowerShell):**
> "PowerShell은 백슬래시(\\) 대신 백틱(\`) 사용합니다. 아래처럼 입력하세요."

```powershell
docker build `
  --build-arg NEXT_PUBLIC_SUPABASE_URL=여기에붙여넣기1 `
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에붙여넣기2 `
  -t marketing-pipeline .
```

> "**여기에붙여넣기1**은 SUPABASE_URL, **여기에붙여넣기2**는 ANON_KEY 값으로 바꿔서 입력하세요.  
> 마지막 줄 끝에 **점(.)** 빠지면 안 됩니다."

> "엔터 누르면 글자가 와르르 올라가기 시작할 거예요. 5~10분 걸립니다.  
> 끝나면 'Successfully tagged marketing-pipeline' 같은 메시지가 나와요."

## 6-2. 빌드 중 대기

> "빌드 도는 동안 잠깐 한숨 돌리시면 됩니다.  
> 화면에 빨간 글씨가 가끔 나와도 괜찮아요. 마지막에 'error' 라는 단어가 나오지 않으면 정상입니다."

→ 5분 후 진행 상황 체크

> "지금 화면에 어떤 글자가 보이세요?"

→ `Successfully` 또는 `naming to docker.io/library/marketing-pipeline` 보이면 완료

## 6-3. 빌드 실패 시 대응

| 오류 메시지 | 대응 |
|---|---|
| `Cannot connect to Docker daemon` | Docker Desktop 실행됐는지 확인 |
| `failed to solve` | 인터넷 연결 확인 후 재시도 |
| `unauthorized` | 같은 명령어 다시 실행 (간헐적 오류) |
| `no space left on device` | Docker Desktop 설정 → Resources → Disk image size 늘리기 |

---

# Phase 7 — 컨테이너 실행 (3분)

## 7-1. 실행

> "빌드 끝났으면 이제 프로그램을 켤 거예요. 한 줄짜리 명령어입니다."

**Mac:**
```bash
docker run -d --name pipeline-dashboard -p 3000:3000 -v $(pwd)/.env:/app/.env --restart unless-stopped marketing-pipeline
```

**Windows (PowerShell):**
```powershell
docker run -d --name pipeline-dashboard -p 3000:3000 -v "${PWD}/.env:/app/.env" --restart unless-stopped marketing-pipeline
```

> "엔터 누르면 영어로 된 길쭉한 문자열이 한 줄 나옵니다.  
> 이건 컨테이너 ID라는 건데, 그냥 잘 됐다는 표시예요."

## 7-2. 브라우저 접속

> "이제 브라우저 새 창 열어서 주소창에 **localhost:3000** 입력하세요."

→ 잠깐 기다림

> "대시보드 화면 떴나요? **음원 홍보 대시보드** 라고 위에 써있고, 도넛 차트 3개 보여야 합니다."

→ 떴으면 ✅ 설치 성공

## 7-3. 화면 확인 안 될 때

> "**This site can't be reached** 같은 오류 뜨면 30초만 기다리고 새로고침 해보세요.  
> Next.js 첫 시작이라 시간이 걸립니다."

> "여전히 안 뜨면 터미널에서 아래 명령어로 로그 확인할게요."

```bash
docker logs pipeline-dashboard
```

→ 로그 내용 알려달라고 한 후 진단

---

# Phase 8 — E2E 테스트 (15분)

## 8-1. 첫 수집 테스트 (작게)

> "이제 작동 확인을 위해 **테스트로 한 번 수집을 돌려볼게요.**  
> 진짜로 신곡 가수들 데이터가 들어오는지 보는 거예요."

> "대시보드 우측 상단에 **▶ 멜론 실행** 또는 **▶ 지니 1p 실행** 버튼이 보이실 거예요.  
> **지니** 선택하시고 **1p** 눌러주세요. 그리고 **▶ 지니 1p 실행** 누르세요."

> "검은 로그 창이 열리고 글자가 올라갈 거예요.  
> 1~2분 정도 걸립니다. **=== 완료 ===** 라는 줄이 나오면 끝입니다."

## 8-2. 결과 확인

> "완료되면 화면 가운데 **발송대기** 탭에 가수들이 쭉 나타날 거예요.  
> 몇 명 들어왔는지 보이시나요?"

→ 보통 10~30명 정도

> "위에 도넛 차트도 채워졌을 거예요.  
> **인스타 확보율**이 60~80% 정도 나오면 정상입니다."

## 8-3. 가수 카드 클릭 테스트

> "아무 가수 한 명 행을 클릭해보세요.  
> 오른쪽에서 슬라이드 패널이 나오면서 가수 정보가 떠야 합니다."

→ 패널 안에서 확인할 것:
- 가수명, 곡명, 앨범
- 인스타 핸들 또는 이메일
- 신뢰도 점수

> "X 버튼 눌러서 패널 닫으세요."

## 8-4. DM 발송 테스트 (실제 발송 X)

> "이번엔 DM 버튼을 한번 눌러볼게요. **실제로 메시지 발송되는 건 아니고요,**  
> 인스타그램 창이 열리면서 인사 문구가 클립보드에 복사됩니다."

> "행 옆에 **DM** 버튼 (파란색) 누르세요."

→ 동작 확인:
1. 새 탭에 인스타 DM 창 열림
2. 토스트 알림 "DM 발송 완료" 뜸
3. 그 행이 회색으로 변하고 "재DM"으로 바뀜
4. **발송완료** 탭에 한 명 추가됨

> "인스타 창은 그냥 닫으시면 됩니다. **실제 발송 안 했으니까 걱정 마세요.**"

## 8-5. 검토필요 탭 확인

> "**검토필요** 탭 한번 눌러보세요.  
> 인스타를 못 찾은 가수들이 카드로 보입니다.  
> 사용자가 직접 인스타 핸들 입력해서 저장하는 곳이에요."

> "지금은 그냥 확인만 하시고 다른 탭 눌러보세요."

## 8-6. 날짜 이동 테스트

> "화면 가운데 **'오늘 · 2026-04-29'** 같은 날짜 버튼 보이시죠?  
> 양옆 화살표로 어제, 그제 데이터 볼 수 있습니다.  
> 날짜 텍스트 직접 클릭하면 달력이 뜨고요."

---

# Phase 9 — 일상 사용법 안내 (5분)

## 9-1. 매일 하는 작업

> "매일 사용하실 때는 **이렇게** 하시면 됩니다."

1. **Docker Desktop 실행 확인** (작업표시줄 고래 아이콘)
2. 브라우저에서 `localhost:3000` 접속
3. **▶ 실행** 버튼 눌러서 신곡 수집 (1~2분)
4. **발송대기** 탭에서 가수들 확인
5. 한 명씩 **DM** 버튼 누르면서 인스타에서 메시지 발송
6. 답장 오면 가수 행 클릭 → 패널에서 **답장완료** 체크 + 결과(긍정/거절/보류) 선택

## 9-2. 컴퓨터 껐다 켰을 때

> "컴퓨터 재시작하시면 자동으로 다시 켜지게 설정해뒀어요.  
> Docker Desktop만 실행되어 있으면 됩니다."

> "혹시 안 뜨면 터미널에서 이 명령어 한 줄 입력하시면 돼요."

```bash
docker start pipeline-dashboard
```

## 9-3. 메모, 계약 진행 관리

> "가수 패널에서 **메모** 적을 수 있고요,  
> **재연락 날짜**도 설정 가능합니다.  
> 답장 받은 가수가 계약으로 이어지면 **계약 진행중** → **계약 완료** 표시도 가능해요.  
> 다 통계로 잡힙니다."

## 9-4. 통계 보기

> "왼쪽 위 **DB 관리** 메뉴 들어가시면 전체 통계 볼 수 있어요.  
> 인스타 확보율, 발송률, 답장률, 계약 성사율 다 한눈에 보입니다."

---

# Phase 10 — 마무리 + 업데이트 안내

> "오늘 설치한 거 마지막으로 확인할게요."

- [ ] Docker Desktop 실행 중 (고래 아이콘)
- [ ] 브라우저에서 `localhost:3000` 접속 가능
- [ ] ▶ 실행 버튼으로 수집 동작 확인
- [ ] 발송대기 탭에 가수 목록 보임
- [ ] DM 버튼 클릭 시 인스타 창 열림
- [ ] `.env` 파일이 marketing-pipeline 폴더 안에 있음

## 업데이트 안내

> "마지막으로 한 가지만 알려드리면, 나중에 새 버전이 나왔을 때 업데이트 방법이에요.  
> 정말 간단합니다. 명령어 한 줄로 끝나요."

**Mac:**
```bash
cd ~/Desktop/marketing-pipeline && ./update.sh
```

**Windows (PowerShell — 최초 1회만 권한 허용):**
> "Windows에선 한 번만 PowerShell 권한을 풀어주셔야 해요. 이거 한 번만 입력해주세요."

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

> "묻는 창 뜨면 **Y** 입력. 이후로는 안 물어봅니다."

```powershell
cd $HOME\Desktop\marketing-pipeline ; .\update.ps1
```

> "이거만 입력하시면 자동으로 새 코드 받고, 다시 빌드하고, 다시 실행까지 해줍니다.  
> 5~10분 걸리고요. 새 버전 있을 때 제가 알려드릴게요."

> "다 되셨으면 설치 완료입니다.  
> 사용 중에 막히는 거 있으시면 언제든 연락주세요."

---

# 자주 묻는 질문 (FAQ)

## Q1. 매일 컴퓨터 켜야 하나요?
A. 네. 그 컴퓨터에서만 작동합니다. 24시간 돌리고 싶으면 클라우드 서버 배포 필요(별도 안내).

## Q2. 인스타 핸들이 잘못 들어왔어요
A. 가수 행 클릭 → 패널에서 **인스타 핸들 수정** 버튼으로 직접 변경 가능.

## Q3. 한 가수에게 여러 번 DM 보내도 되나요?
A. 네. 시스템에 발송 횟수가 자동 기록됩니다. 2번째 누르면 **2차DM** 으로 표시.

## Q4. 데이터를 다른 사람과 공유하려면?
A. DB는 클라우드에 있어서 다른 컴퓨터에 같은 방법으로 설치하면 같은 데이터를 보게 됩니다.  
하지만 **동시에 두 컴퓨터에서 실행 버튼 누르지 마세요.** 중복 데이터가 생길 수 있습니다.

## Q5. 프로그램이 안 켜져요
A. 1) Docker Desktop 실행 확인 → 2) `docker start pipeline-dashboard` → 3) 그래도 안 되면 담당자 연락.

## Q6. 업데이트 스크립트가 안 돌아가요
A. 권한 문제일 수 있음. Mac에선 `chmod +x update.sh` 한 번 실행하면 됨.  
그래도 안 되면 README의 "수동 업데이트" 섹션 따라하기.

---

# 통화 후 담당자 체크

- [ ] 고객사 컴퓨터 재시작 후에도 자동 실행되는지 다음날 확인 전화
- [ ] Supabase 대시보드에서 데이터 들어왔는지 확인
- [ ] 일주일 뒤 사용 만족도 체크
