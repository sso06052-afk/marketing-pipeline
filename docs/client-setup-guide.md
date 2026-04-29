# 음원 홍보 파이프라인 — 설치 및 사용 가이드

> 전화 통화 중 이 문서를 보면서 따라하시면 됩니다.  
> 막히는 부분이 있으면 담당자에게 바로 연락주세요.

---

## 사전 확인

아래 두 가지가 있어야 합니다.

1. **받은 파일**: `marketing_pipeline` 폴더 (압축 파일이면 먼저 압축 해제)
2. **API 키 목록**: 담당자에게 받은 키값 문서 (Supabase, Gemini, Serper 등)

---

## STEP 1 — Docker Desktop 설치

> Docker는 이 프로그램을 실행하는 엔진입니다. 최초 1회만 설치합니다.

### Mac
1. 브라우저에서 `docker.com/products/docker-desktop` 접속
2. **Mac — Apple Chip** 또는 **Mac — Intel Chip** 중 본인 맥에 맞는 것 다운로드  
   *(모르겠으면: 화면 왼쪽 상단 애플 로고 → 이 Mac에 관하여 → 프로세서 항목 확인)*
3. 다운받은 `.dmg` 파일 열기 → Docker 아이콘을 Applications 폴더로 드래그
4. Docker Desktop 실행 → 약관 동의 → **상단 메뉴바에 고래 아이콘이 뜨면 완료**

### Windows
1. 브라우저에서 `docker.com/products/docker-desktop` 접속
2. **Windows** 버전 다운로드
3. 설치 중 "Use WSL 2 instead of Hyper-V" 옵션이 뜨면 **체크한 채로** 진행
4. 설치 완료 후 재부팅 요청이 오면 재부팅
5. Docker Desktop 실행 → 약관 동의 → **하단 작업표시줄에 고래 아이콘이 뜨면 완료**

> **Windows에서 "WSL2 설치 필요" 오류가 뜨면?**  
> 화면에 나오는 링크 클릭해서 WSL2 업데이트 설치 후 Docker 재실행

---

## STEP 2 — 환경변수 파일 설정

> API 키들을 프로그램에 알려주는 파일입니다.

1. `marketing_pipeline` 폴더 안에 **`.env`** 라는 이름의 파일을 만듭니다  
   *(점으로 시작하는 파일입니다)*

2. 아래 내용을 복사해서 붙여넣고, `...` 부분을 받은 키값으로 채웁니다:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SERPER_API_KEY=...
GEMINI_API_KEY=...
```

> **파일 만드는 법 (Mac)**  
> 텍스트 편집기 열기 → 내용 입력 → 저장할 때 파일명을 `.env` 로 입력  
> (포맷: "일반 텍스트"로 저장해야 합니다)

> **파일 만드는 법 (Windows)**  
> 메모장 열기 → 내용 입력 → 다른 이름으로 저장 → 파일명 `.env` 입력 → 파일 형식을 "모든 파일"로 변경 후 저장

---

## STEP 3 — 터미널(명령창) 열기

### Mac
- `Cmd + Space` → "터미널" 검색 → 실행
- 또는 Finder → 응용 프로그램 → 유틸리티 → 터미널

### Windows
- 시작 메뉴 → "PowerShell" 검색 → 실행  
  *(CMD 말고 반드시 PowerShell)*

---

## STEP 4 — 프로젝트 폴더로 이동

터미널에서 아래 명령어를 입력합니다.

### Mac
```bash
cd ~/Desktop/marketing_pipeline
```
> 폴더가 다른 곳에 있으면 Finder에서 폴더를 찾고,  
> 폴더를 터미널 창으로 **드래그**하면 경로가 자동 입력됩니다.

### Windows (PowerShell)
```powershell
cd $HOME\Desktop\marketing_pipeline
```

**잘 됐는지 확인**: 아래 명령어 입력 후 `Dockerfile` 파일이 목록에 보이면 OK
```bash
ls
```

---

## STEP 5 — 이미지 빌드 (최초 1회, 5~10분 소요)

> 프로그램을 컴퓨터에 설치하는 단계입니다.  
> 완료될 때까지 터미널을 닫지 마세요.

### Mac
```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=여기에_SUPABASE_URL_입력 \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_ANON_KEY_입력 \
  -t marketing-pipeline .
```

### Windows (PowerShell)
```powershell
docker build `
  --build-arg NEXT_PUBLIC_SUPABASE_URL=여기에_SUPABASE_URL_입력 `
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_ANON_KEY_입력 `
  -t marketing-pipeline .
```

> **`여기에_...`** 부분을 `.env` 파일에 넣은 실제 값으로 교체해서 입력하세요.  
> 마지막 점(`.`) 빠뜨리지 마세요.

진행 중에 `Successfully built` 또는 `Successfully tagged` 가 뜨면 완료입니다.

---

## STEP 6 — 대시보드 실행

### Mac
```bash
docker run -d \
  --name pipeline-dashboard \
  -p 3000:3000 \
  -v $(pwd)/.env:/app/.env \
  --restart unless-stopped \
  marketing-pipeline
```

### Windows (PowerShell)
```powershell
docker run -d `
  --name pipeline-dashboard `
  -p 3000:3000 `
  -v "${PWD}/.env:/app/.env" `
  --restart unless-stopped `
  marketing-pipeline
```

실행 후 브라우저에서 **`http://localhost:3000`** 접속하면 대시보드가 열립니다.

> `--restart unless-stopped` 옵션 덕분에 컴퓨터를 재시작해도 자동으로 다시 켜집니다.

---

## 일상 사용법

### 신곡 수집하기
대시보드 우측 상단 **▶ 실행** 버튼 클릭  
→ 수집 소스(멜론/지니)와 페이지 수 선택 후 실행  
→ 로그 창에서 실시간 진행 상황 확인 가능

### DM 발송하기
1. 발송대기 탭에서 가수 목록 확인
2. **DM** 버튼 클릭 → 인스타그램이 자동으로 열리고 DM 문구가 클립보드에 복사됨
3. 인스타그램에서 붙여넣기 후 발송

### 답장 왔을 때
가수 행 클릭 → 슬라이드 패널에서 **답장완료** 체크 + 결과(긍정/거절/보류) 선택

### 대시보드 끄고 켜기
```bash
# 끄기
docker stop pipeline-dashboard

# 켜기
docker start pipeline-dashboard
```

---

## 자주 묻는 문제

### "Cannot connect to Docker daemon" 오류
→ Docker Desktop이 실행 중인지 확인. 고래 아이콘이 없으면 Docker Desktop 앱을 실행하세요.

### "port is already allocated" 오류
→ 3000번 포트를 다른 프로그램이 쓰고 있습니다. 아래 명령어로 포트를 바꿔 실행:
```bash
# 3001번 포트로 변경
docker run -d --name pipeline-dashboard -p 3001:3000 -v $(pwd)/.env:/app/.env marketing-pipeline
# 접속: http://localhost:3001
```

### "name already in use" 오류
→ 같은 이름의 컨테이너가 이미 있습니다. 아래 명령어 후 다시 STEP 6 실행:
```bash
docker rm -f pipeline-dashboard
```

### 대시보드가 빈 화면이거나 오류 표시
→ `.env` 파일의 Supabase 키가 올바른지 확인하세요.

### 로그 확인
```bash
docker logs pipeline-dashboard
```

---

## 업데이트 받을 때

새 파일을 받으면 아래 순서로 진행합니다.

1. 기존 컨테이너 삭제: `docker rm -f pipeline-dashboard`
2. STEP 5 (빌드) 다시 실행
3. STEP 6 (실행) 다시 실행

> `.env` 파일은 건드리지 않아도 됩니다.
