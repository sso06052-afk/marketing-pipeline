# 업데이트 스크립트 (Windows PowerShell)
# 사용법: PowerShell에서 .\update.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " 음원 홍보 파이프라인 — 업데이트 시작" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan

# .env 파일 존재 확인
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env 파일이 없습니다. 처음 설치라면 README를 참조하세요." -ForegroundColor Red
    exit 1
}

# 1. 최신 코드 받기
Write-Host "`n▶ [1/4] GitHub에서 최신 코드 받는 중..." -ForegroundColor Yellow
git pull origin main

# 2. .env에서 키 자동 추출
$envVars = @{}
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

if (-not $envVars["NEXT_PUBLIC_SUPABASE_URL"] -or -not $envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
    Write-Host "❌ .env 파일에 NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 없습니다." -ForegroundColor Red
    exit 1
}

# 3. 기존 컨테이너 삭제
Write-Host "`n▶ [2/4] 기존 컨테이너 정리 중..." -ForegroundColor Yellow
docker rm -f pipeline-dashboard 2>$null

# 4. 새 이미지 빌드
Write-Host "`n▶ [3/4] Docker 이미지 빌드 중... (5~10분)" -ForegroundColor Yellow
docker build `
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$($envVars["NEXT_PUBLIC_SUPABASE_URL"]) `
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$($envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"]) `
  -t marketing-pipeline .

# 5. 컨테이너 실행
Write-Host "`n▶ [4/4] 대시보드 시작 중..." -ForegroundColor Yellow
docker run -d `
  --name pipeline-dashboard `
  -p 3000:3000 `
  -v "${PWD}/.env:/app/.env" `
  --restart unless-stopped `
  marketing-pipeline

Write-Host "`n═══════════════════════════════════════════" -ForegroundColor Green
Write-Host " ✅ 업데이트 완료!" -ForegroundColor Green
Write-Host " 브라우저: http://localhost:3000" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
