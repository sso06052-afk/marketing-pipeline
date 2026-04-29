# Docker 배포 가이드 — 마케팅 파이프라인

## 고객사가 해야 할 일

### 1. 사전 준비 (1회만)

**Docker Desktop 설치**
- https://www.docker.com/products/docker-desktop 에서 다운로드 후 설치
- 설치 완료 후 Docker Desktop 실행 (상단 바에 고래 아이콘이 뜨면 준비 완료)

---

### 2. 환경변수 파일 설정

프로젝트 폴더 안에 `.env` 파일을 만들고 아래 내용을 채워넣습니다.

```env
# Supabase (필수)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJhbGci...

# Spotify (인스타 탐색용)
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...

# YouTube API (인스타 탐색용)
YOUTUBE_API_KEY=...

# Serper (구글 검색, 선택)
SERPER_API_KEY=...

# Gemini (인스타 판별용)
GEMINI_API_KEY=...

# 대시보드 환경변수
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

---

### 3. Docker 이미지 빌드

터미널(Mac: 터미널 앱, Windows: PowerShell)을 열고 프로젝트 폴더로 이동합니다.

```bash
cd /경로/marketing_pipeline

# 이미지 빌드 (최초 1회, 5~10분 소요)
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci... \
  -t marketing-pipeline .
```

> `NEXT_PUBLIC_` 값은 `.env` 파일의 값과 동일하게 입력하세요.

---

### 4. 대시보드 실행

```bash
docker run -d \
  --name pipeline-dashboard \
  -p 3000:3000 \
  -v $(pwd)/.env:/app/.env \
  marketing-pipeline
```

브라우저에서 `http://localhost:3000` 접속하면 대시보드가 열립니다.

---

### 5. 파이프라인 수동 실행 (신곡 수집)

대시보드에서 **▶ 실행** 버튼을 클릭하면 실시간으로 수집이 진행됩니다.

터미널에서 직접 실행하려면:

```bash
# 멜론 신곡 수집
docker exec pipeline-dashboard python /app/pipeline/pipeline.py --source melon

# 지니 신곡 수집 (3페이지)
docker exec pipeline-dashboard python /app/pipeline/pipeline.py --source genie --pages 3
```

---

### 6. 컨테이너 관리

```bash
# 중지
docker stop pipeline-dashboard

# 재시작
docker start pipeline-dashboard

# 로그 확인
docker logs pipeline-dashboard

# 삭제 후 재시작 (업데이트 시)
docker rm -f pipeline-dashboard
docker run -d --name pipeline-dashboard -p 3000:3000 \
  -v $(pwd)/.env:/app/.env marketing-pipeline
```

---

### 7. 이미지 업데이트 (새 버전 받을 때)

새 파일을 받으면 기존 컨테이너 삭제 후 이미지를 다시 빌드합니다.

```bash
docker rm -f pipeline-dashboard
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci... \
  -t marketing-pipeline .
docker run -d --name pipeline-dashboard -p 3000:3000 \
  -v $(pwd)/.env:/app/.env marketing-pipeline
```
