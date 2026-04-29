#!/bin/sh
set -e

# .env 파일이 있으면 로드 (파이프라인용)
if [ -f /app/.env ]; then
    export $(grep -v '^#' /app/.env | xargs)
fi

echo "=== 마케팅 파이프라인 대시보드 시작 ==="
echo "대시보드: http://localhost:3000"
echo ""

cd /app/dashboard
exec node_modules/.bin/next start -p 3000
