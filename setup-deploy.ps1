# ============================================================
#  setup-deploy.ps1
#  Reads keys from secrets.local.txt and injects them into
#  Vercel (dashboard) + Railway (pipeline), then redeploys both.
#
#  Usage:  powershell -ExecutionPolicy Bypass -File ./setup-deploy.ps1
# ============================================================
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$VERCEL_PROJECT  = "dashboard"
$VERCEL_URL      = "https://dashboard-jade-ten-65.vercel.app"
$RAILWAY_SERVICE = "marketing-pipeline"

# -- 1. parse secrets.local.txt ------------------------------
$secretsFile = Join-Path $root "secrets.local.txt"
if (-not (Test-Path $secretsFile)) { throw "secrets.local.txt not found. Copy from .env.example." }

$S = @{}
foreach ($line in Get-Content $secretsFile) {
    if ($line -match '^\s*#') { continue }
    if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)$') {
        $S[$matches[1]] = $matches[2].Trim()
    }
}

# -- 2. validate required ------------------------------------
$required = @("SUPABASE_URL","SUPABASE_ANON_KEY","SUPABASE_SERVICE_KEY","SERPER_API_KEY","GEMINI_API_KEY","RAILWAY_TOKEN")
$missing = $required | Where-Object { [string]::IsNullOrWhiteSpace($S[$_]) }
if ($missing) { throw "Empty required keys in secrets.local.txt: $($missing -join ', ')" }

# -- 3. auto-generate values ---------------------------------
function New-Secret([int]$bytes = 24) {
    $b = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    return ([Convert]::ToBase64String($b) -replace '[+/=]', '')
}
if ([string]::IsNullOrWhiteSpace($S["API_SECRET"]))         { $S["API_SECRET"] = New-Secret 24;  Write-Host "API_SECRET auto-generated" }
if ([string]::IsNullOrWhiteSpace($S["DASHBOARD_PASSWORD"])) { $S["DASHBOARD_PASSWORD"] = New-Secret 9; Write-Host "DASHBOARD_PASSWORD auto-generated: $($S['DASHBOARD_PASSWORD'])" }

# -- 4. Railway: set token, find URL, inject vars ------------
$env:RAILWAY_TOKEN = $S["RAILWAY_TOKEN"]
Write-Host "`n=== Railway pipeline ==="
$statusOut = railway status 2>&1 | Out-String
$railwayUrl = ([regex]::Match($statusOut, 'https://\S+\.up\.railway\.app')).Value
if (-not $railwayUrl) { throw "Could not detect Railway URL from 'railway status'." }
$railwayUrl = $railwayUrl.TrimEnd('/')
Write-Host "Railway URL: $railwayUrl"

# build --set args, skipping empty values (Railway rejects empty)
$railwayKV = [ordered]@{
    "SUPABASE_URL"    = $S["SUPABASE_URL"]
    "SUPABASE_KEY"    = $S["SUPABASE_SERVICE_KEY"]
    "SERPER_API_KEY"  = $S["SERPER_API_KEY"]
    "GEMINI_API_KEY"  = $S["GEMINI_API_KEY"]
    "MELON_COOKIE"    = $S["MELON_COOKIE"]
    "API_SECRET"      = $S["API_SECRET"]
    "ALLOWED_ORIGINS" = $VERCEL_URL
}
$setArgs = @()
foreach ($k in $railwayKV.Keys) {
    if (-not [string]::IsNullOrWhiteSpace($railwayKV[$k])) {
        $setArgs += "--set"; $setArgs += "$k=$($railwayKV[$k])"
    }
}
$ErrorActionPreference = "Continue"
railway variables --service $RAILWAY_SERVICE @setArgs
if ($LASTEXITCODE -ne 0) { throw "railway variables failed (exit $LASTEXITCODE)" }
$ErrorActionPreference = "Stop"
Write-Host "Railway variables set (auto-redeploys)"

# -- 5. Vercel: inject dashboard vars ------------------------
Write-Host "`n=== Vercel dashboard ==="
Set-Location (Join-Path $root "dashboard")

$vercelVars = [ordered]@{
    "NEXT_PUBLIC_SUPABASE_URL"      = $S["SUPABASE_URL"]
    "NEXT_PUBLIC_SUPABASE_ANON_KEY" = $S["SUPABASE_ANON_KEY"]
    "SUPABASE_SERVICE_KEY"          = $S["SUPABASE_SERVICE_KEY"]
    "NEXT_PUBLIC_PIPELINE_API_URL"  = $railwayUrl
    "PIPELINE_API_URL"              = $railwayUrl
    "NEXT_PUBLIC_PIPELINE_SECRET"   = $S["API_SECRET"]
    "PIPELINE_SECRET"               = $S["API_SECRET"]
    "DASHBOARD_PASSWORD"            = $S["DASHBOARD_PASSWORD"]
}

$ErrorActionPreference = "Continue"
$tmp = Join-Path $env:TEMP "vercel_env_val.txt"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
foreach ($name in $vercelVars.Keys) {
    $val = $vercelVars[$name]
    vercel env rm $name production --yes 2>$null | Out-Null   # ignore "not found"
    # write value to file WITHOUT trailing newline, feed via cmd redirection
    # (PowerShell's `|` pipe appends CR/LF which Vercel stores verbatim -> corrupts value)
    [System.IO.File]::WriteAllText($tmp, $val, $utf8NoBom)
    cmd /c "vercel env add $name production < `"$tmp`"" | Out-Null
    Write-Host "  set $name (exit $LASTEXITCODE)"
}
Remove-Item $tmp -ErrorAction SilentlyContinue

# -- 6. redeploy Vercel production ---------------------------
Write-Host "`n=== Vercel redeploy ==="
vercel --prod --force --yes
$ErrorActionPreference = "Stop"

Write-Host "`nDONE."
Write-Host "  Dashboard : $VERCEL_URL"
Write-Host "  Pipeline  : $railwayUrl"
Write-Host "  Login pw  : $($S['DASHBOARD_PASSWORD'])"
