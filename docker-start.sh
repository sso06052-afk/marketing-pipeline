#!/bin/sh
set -e

# .env 파일이 있으면 shell source 방식으로 로드 (Next.js API routes용)
# Python 파이프라인은 pipeline.py가 자체적으로 dotenv로 로드함
if [ -f /app/.env ]; then
    set -a
    . /app/.env
    set +a
elif [ -d /app/.env ]; then
    echo "[경고] /app/.env 가 디렉토리입니다. 호스트의 .env 를 파일로 다시 만드세요." >&2
fi

echo "=== 마케팅 파이프라인 대시보드 시작 ==="
echo "대시보드: http://localhost:3000"
echo ""

cd /app/dashboard
exec node_modules/.bin/next start -p 3000
