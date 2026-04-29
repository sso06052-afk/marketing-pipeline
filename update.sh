#!/bin/bash
# 업데이트 스크립트 (Mac/Linux)
# 사용법: 터미널에서 ./update.sh 또는 더블클릭(Mac)

set -e
cd "$(dirname "$0")"

echo "═══════════════════════════════════════════"
echo " 음원 홍보 파이프라인 — 업데이트 시작"
echo "═══════════════════════════════════════════"

# .env 파일 존재 확인
if [ ! -f .env ]; then
    echo "❌ .env 파일이 없습니다. 처음 설치라면 README를 참조하세요."
    exit 1
fi

# 1. 최신 코드 받기
echo ""
echo "▶ [1/4] GitHub에서 최신 코드 받는 중..."
git pull origin main

# 2. .env에서 키 자동 추출
source .env
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "❌ .env 파일에 NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 없습니다."
    exit 1
fi

# 3. 기존 컨테이너 삭제
echo ""
echo "▶ [2/4] 기존 컨테이너 정리 중..."
docker rm -f pipeline-dashboard 2>/dev/null || true

# 4. 새 이미지 빌드
echo ""
echo "▶ [3/4] Docker 이미지 빌드 중... (5~10분)"
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t marketing-pipeline .

# 5. 컨테이너 실행
echo ""
echo "▶ [4/4] 대시보드 시작 중..."
docker run -d \
  --name pipeline-dashboard \
  -p 3000:3000 \
  -v "$(pwd)/.env:/app/.env" \
  --restart unless-stopped \
  marketing-pipeline

echo ""
echo "═══════════════════════════════════════════"
echo " ✅ 업데이트 완료!"
echo " 브라우저: http://localhost:3000"
echo "═══════════════════════════════════════════"
