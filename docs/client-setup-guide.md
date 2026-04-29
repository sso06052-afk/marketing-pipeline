# 음원 홍보 파이프라인 — 설치 및 사용 가이드

> 전화 통화 중 이 문서를 보면서 따라하시면 됩니다.  
> 막히는 부분이 있으면 담당자에게 바로 연락주세요.

---

## 사전 확인

### 준비물
1. **받은 파일**: `marketing_pipeline` 폴더 (압축 파일이면 먼저 압축 해제)
2. **API 키 6개**: Supabase, Gemini, Serper 가입 후 발급받은 키들  
   → 아직 발급 안 했으면 **[API 키 발급 가이드](api-keys-setup.md)** 먼저 보세요

### 시스템 요구사항
- **OS**: Mac 10.15 이상 / Windows 10·11
- **메모리**: 최소 8GB (16GB 권장)
- **디스크**: 최소 10GB 여유공간
- **인터넷**: 필수 (수집·DB 통신)

### 보안 주의사항 ⚠️
- API 키 문서와 **`.env` 파일은 외부에 절대 공유하지 마세요**
  - 메일 첨부, 슬랙, 카톡, GitHub 모두 금지
  - DB 비밀번호와 동급의 민감 정보입니다
- 키가 유출된 것 같으면 **즉시 담당자에게 연락**

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

### 1. 신곡 수집하기

**우측 상단 컨트롤:**
- **소스 선택** — 멜론 / 지니 토글
- **페이지 수** — 지니 선택 시 1p~5p 선택 (한 페이지당 약 30곡)
- **▶ 실행** 버튼 클릭

수집이 시작되면 검은 로그 창이 열리고 실시간으로 진행 상황이 표시됩니다.  
완료까지 약 1~5분 (가수 수에 따라 다름).

> **팁**: 매일 같은 시간에 수집하면 중복 없이 신곡만 누적됩니다.

---

### 2. 가수 카드 보는 법

**가수 행에 표시되는 정보:**
- 가수명, 장르·소속사
- 대표곡, 발매일
- 인스타 핸들 또는 이메일
- 신뢰도 점수 (색상 막대)
  - 🟢 녹색 (80~97점): 매우 신뢰 가능
  - 🟡 노란색 (60~79점): 보통
  - 🔴 빨간색 (60점 이하): "확인" 배지 표시 — 직접 검토 권장

**행을 클릭하면** 우측에서 슬라이드 패널이 열리고 상세 정보·관리 기능이 표시됩니다.

---

### 3. DM 발송하기

1. **발송대기** 탭에서 가수 확인
2. 행 우측의 **DM** 버튼 클릭

→ 자동으로 일어나는 일:
- 인스타그램 DM 창이 새 탭에 열림
- 클립보드에 인사 문구 자동 복사 (`안녕하세요 가수명님`)
- 발송 기록이 DB에 저장됨
- 행이 회색으로 변하고 **재DM** 버튼으로 변경

3. 인스타그램에서 **Cmd+V (Mac) / Ctrl+V (Win)** 로 붙여넣고 본인 멘트 추가 후 발송

> **2차 발송 표시**: 답장 없는 가수에게 한 번 더 DM 보낼 때 **2차DM** 버튼이 주황색으로 표시됩니다.

---

### 4. 답장이 왔을 때

1. 해당 가수 행을 **클릭** (행 어디든)
2. 우측 패널에서 **답장완료** 체크
3. 결과 선택:
   - **긍정** — 관심 보임, 미팅·계약 가능성
   - **보류** — 답장은 했지만 결정 보류
   - **거절** — 명확한 거절

→ **답장완료** 탭으로 자동 이동, 색상 배지 표시

---

### 5. 메모 / 재연락 / 계약 관리

가수 패널에서 추가로 관리할 수 있는 기능:

| 기능 | 사용 시점 |
|---|---|
| **📝 메모** | 통화 내용, 협상 조건, 특이사항 기록 |
| **🔁 재연락 날짜** | "○월○일에 다시 연락" 일정 설정 |
| **계약 진행중** | 답장 후 협상 단계 진입 시 |
| **계약 완료** | 최종 계약 성사 시 |

→ 입력한 정보는 가수 행에 아이콘(📝🔁)으로 표시되어 한눈에 파악 가능

---

### 6. 검토필요 탭

인스타 계정을 자동으로 못 찾은 가수들이 모이는 곳입니다.

1. **검토필요** 탭 클릭 (탭에 빨간 점이 있으면 처리 대기 가수 있음)
2. 카드에서 **멜론 →** 링크 클릭해서 가수 정보 확인
3. 직접 인스타에서 검색 후 핸들 입력
4. **저장** 버튼 → 발송대기 탭으로 자동 이동

---

### 7. 날짜별 관리

화면 가운데 **'오늘 · 2026-04-29'** 텍스트가 날짜 선택기입니다.

- **← →** 버튼: 어제/내일 이동
- **날짜 클릭**: 달력 팝업 (주황색 점 = 미발송 가수 있는 날)

→ 과거 날짜로 이동하면 그날 수집된 가수들의 발송 내역을 확인할 수 있습니다.

---

### 8. 통계 보기 (DB 관리 메뉴)

상단 네비게이션에서 **DB 관리** 클릭

**목록 탭:**
- 검색 (Enter로 실행)
- 상태 필터 (발송완료, 답장 받음, 계약 진행중 등)
- 정렬 (최신순, 신뢰도순 등)

**통계 탭:**
- 인스타 출처별 분포 (멜론/구글/수동)
- 장르별 분포
- 14일간 수집 추이 그래프
- **계약 성사율** — 접촉한 가수 중 계약 성사 비율

---

### 9. 대시보드 끄고 켜기

```bash
# 끄기
docker stop pipeline-dashboard

# 켜기
docker start pipeline-dashboard

# 컨테이너 상태 확인
docker ps
```

> 컴퓨터 재시작 후 자동으로 켜지도록 설정되어 있습니다.  
> 그래도 안 켜지면 위 `docker start` 명령어를 입력하세요.

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
