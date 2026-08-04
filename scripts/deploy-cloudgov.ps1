<#
.SYNOPSIS
  Build the SemperScribe static export for cloud.gov and push it.

.DESCRIPTION
  The single most likely failure on this path is a basePath mismatch.
  next.config.ts defaults DEPLOY_TARGET to 'ghpages', which prefixes every
  asset with /semperscribe. On cloud.gov the app is served at the route
  root, so a ghpages build deploys a page that loads with no styling and
  a console full of 404s. This script sets DEPLOY_TARGET explicitly and
  then PROVES the result by inspecting the built HTML before pushing.

  npm run deploy is the GitHub Pages path (gh-pages -d out). Do not use it
  for cloud.gov.

.PARAMETER SkipTests
  Skip typecheck and vitest. Use only when re-pushing a build you already
  gated. Not the default, on purpose.

.PARAMETER SkipGolden
  Run every test EXCEPT tests/golden. The golden page-parity test shells
  out to LibreOffice and hard-fails, by its author's explicit choice, when
  soffice is absent. That is the correct default for CI. On a workstation
  without LibreOffice it blocks a deploy for a reason unrelated to the
  deploy. This switch drops only that directory and names what it dropped.

  The real fix is to install LibreOffice:
    winget install TheDocumentFoundation.LibreOffice
  then set SOFFICE_PATH if it lands somewhere non-standard.

.PARAMETER WhatIf
  Build and verify, then stop before cf push.

.NOTES
  Runs on Windows PowerShell 5.1 and on PowerShell 7. Nothing here uses
  7-only syntax, so `powershell` and `pwsh` both work.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\deploy-cloudgov.ps1 -WhatIf
  powershell -ExecutionPolicy Bypass -File .\scripts\deploy-cloudgov.ps1
#>
#Requires -Version 5.1
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$SkipTests,
  [switch]$SkipGolden,
  [string]$CfApi   = 'https://api.fr.cloud.gov',
  [string]$AppName = 'semperscribe',
  [string]$Route   = 'semperscribe.app.cloud.gov'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Windows PowerShell 5.1 still negotiates TLS 1.0 by default on some hosts.
# cloud.gov refuses it, so the post-push smoke test would fail on a healthy
# deploy and read as a broken one. PowerShell 7 already defaults higher.
try {
  [Net.ServicePointManager]::SecurityProtocol =
    [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {
  Write-Host '  Could not raise TLS to 1.2. The smoke test may fail on an otherwise good push.' -ForegroundColor Yellow
}

# Native commands do not honour $ErrorActionPreference on 5.1, so every
# external call below checks $LASTEXITCODE explicitly rather than relying
# on a throw that will not come.
$LASTEXITCODE = 0

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot

function Step([string]$m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Fail([string]$m) { Write-Host "FAIL: $m" -ForegroundColor Red; Pop-Location; exit 1 }
function Ok([string]$m)   { Write-Host "  ok  $m" -ForegroundColor Green }

try {
  # -------------------------------------------------------------- 0. Tooling
  Step '0. Tooling'
  foreach ($t in @('node', 'npm', 'cf')) {
    if (-not (Get-Command $t -ErrorAction SilentlyContinue)) {
      Fail "$t not on PATH. Install the Cloud Foundry CLI from https://github.com/cloudfoundry/cli/releases if cf is what is missing."
    }
  }
  Ok "node $(node --version), npm $(npm --version)"
  Ok ((cf version) -join ' ')

  # ------------------------------------------------------ 1. Working tree
  Step '1. Working tree'
  if (Get-Command git -ErrorAction SilentlyContinue) {
    $dirty = git status --porcelain
    if ($dirty) {
      Write-Host '  Uncommitted changes present:' -ForegroundColor Yellow
      $dirty | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
      Write-Host '  Pushing an uncommitted tree means the deployed bundle has no commit to trace it to.' -ForegroundColor Yellow
      $a = Read-Host '  Continue anyway? (y/N)'
      if ($a -ne 'y') { Fail 'Stopped. Commit first.' }
    } else {
      Ok "clean at $(git rev-parse --short HEAD)"
    }
  }

  # ----------------------------------------------------------- 2. Install
  Step '2. Dependencies'
  if (Test-Path 'package-lock.json') { npm ci } else { npm install }
  if ($LASTEXITCODE -ne 0) { Fail 'Dependency install failed.' }
  Ok 'installed'

  # -------------------------------------------------------------- 3. Gate
  if ($SkipTests) {
    Write-Host "`n  SKIPPING typecheck AND the whole test suite by request." -ForegroundColor Yellow
    Write-Host '  If LibreOffice is the only thing in your way, use -SkipGolden instead.' -ForegroundColor Yellow
    Write-Host '  It keeps the typecheck and 1,550-odd tests, and drops one directory.' -ForegroundColor Yellow
  } else {
    Step '3. Typecheck'
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { Fail 'TypeScript errors. Nothing ships with a broken typecheck.' }
    Ok 'tsc clean'

    Step '4. Tests'
    if ($SkipGolden) {
      Write-Host '  DROPPED FROM THIS RUN: tests/golden' -ForegroundColor Yellow
      Write-Host '  Those cover PDF vs DOCX pagination parity and need LibreOffice.' -ForegroundColor Yellow
      Write-Host '  Nothing below this line was checked against a rendered DOCX.' -ForegroundColor Yellow
      npx vitest run --exclude "tests/golden/**"
    } else {
      $soffice = $env:SOFFICE_PATH
      if (-not $soffice) { $soffice = 'C:\Program Files\LibreOffice\program\soffice.exe' }
      if (-not (Test-Path $soffice)) {
        Write-Host "  LibreOffice not found at $soffice." -ForegroundColor Yellow
        Write-Host '  tests/golden will hard-fail. That is intentional in the test, not a bug.' -ForegroundColor Yellow
        Write-Host '  Install it:  winget install TheDocumentFoundation.LibreOffice' -ForegroundColor Yellow
        Write-Host '  Or re-run with -SkipGolden to drop that directory and say so out loud.' -ForegroundColor Yellow
      }
      npm test
    }
    if ($LASTEXITCODE -ne 0) { Fail 'Test suite failed.' }
    Ok $(if ($SkipGolden) { 'suite green, minus tests/golden' } else { 'suite green' })
  }

  # ------------------------------------------------------------- 5. Build
  Step '5. Build for cloud.gov'
  if (Test-Path 'out')   { Remove-Item -Recurse -Force 'out' }
  if (Test-Path '.next') { Remove-Item -Recurse -Force '.next' }
  Ok 'out/ and .next/ removed, so nothing stale survives into the push'

  $env:DEPLOY_TARGET = 'cloudgov'
  $env:NODE_ENV = 'production'
  Write-Host '  DEPLOY_TARGET=cloudgov  (basePath resolves to empty)' -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { Fail 'Build failed.' }

  # -------------------------------------------------------- 6. Prove it
  # This is the step worth having. A ghpages build succeeds just as
  # cleanly as a cloudgov build; the difference only shows in the asset
  # paths, and only after it is live.
  Step '6. Verify the built bundle'
  if (-not (Test-Path 'out/index.html')) { Fail 'out/index.html missing. The export did not run.' }

  $html = Get-Content 'out/index.html' -Raw
  if ($html -match '/semperscribe/_next/') {
    Fail 'Built HTML references /semperscribe/_next/. This is a GitHub Pages build. DEPLOY_TARGET did not reach next.config.ts. Every asset would 404 on cloud.gov.'
  }
  if ($html -notmatch '/_next/') {
    Fail 'Built HTML references no /_next/ assets at all. Inspect out/index.html by hand before pushing.'
  }
  Ok 'asset paths resolve at the route root'

  $count = (Get-ChildItem 'out' -Recurse -File).Count
  $mb    = [math]::Round(((Get-ChildItem 'out' -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 1)
  Ok "$count files, $mb MB"
  if ($mb -gt 200) { Write-Host "  Larger than the 256 MB disk_quota in manifest.yml leaves much room." -ForegroundColor Yellow }

  # ------------------------------------------------------------ 7. Target
  Step '7. cloud.gov target'
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $target = (cf target) 2>&1 | Out-String
  $ErrorActionPreference = $prevEap
  if ($LASTEXITCODE -ne 0 -or $target -match 'Not logged in') {
    Write-Host "  Not logged in. Run this, then re-run the script:" -ForegroundColor Yellow
    Write-Host "    cf login -a $CfApi --sso" -ForegroundColor Yellow
    Fail 'No active cf session.'
  }
  Write-Host $target
  $a = Read-Host "  Push '$AppName' to $Route in the org and space above? (y/N)"
  if ($a -ne 'y') { Fail 'Stopped before push.' }

  # -------------------------------------------------------------- 8. Push
  Step '8. Push'
  if ($PSCmdlet.ShouldProcess($Route, 'cf push')) {
    cf push
    if ($LASTEXITCODE -ne 0) { Fail 'cf push failed. Check cf logs semperscribe --recent.' }
    Ok 'pushed'

    Step '9. Smoke test'
    Start-Sleep -Seconds 5
    try {
      $r = Invoke-WebRequest "https://$Route/" -UseBasicParsing -TimeoutSec 30
      if ($r.StatusCode -ne 200) { Fail "Route returned HTTP $($r.StatusCode)." }
      if ($r.Content -match '/semperscribe/_next/') { Fail 'Live page serves GitHub Pages asset paths. Wrong bundle is deployed.' }
      Ok "https://$Route/ returned 200 with root-relative assets"
    } catch {
      Write-Host "  Could not verify the live route: $($_.Exception.Message)" -ForegroundColor Yellow
      Write-Host '  Check it in a browser before telling anyone it is up.' -ForegroundColor Yellow
    }

    Write-Host "`nDone. Next, verify the EDMS handoff by hand:" -ForegroundColor Cyan
    Write-Host "  https://$Route/#edms=v=1&rid=1&ruc=12345&ssic=1650&doc=basic&sec=S-1" -ForegroundColor Cyan
    Write-Host '  Expect SSIC and unit prefilled, the EDMS banner shown, and GunnyBot locked to GenAI.mil.' -ForegroundColor Cyan
  } else {
    Write-Host "`nWhatIf: build verified, push skipped." -ForegroundColor Cyan
  }
}
finally {
  Remove-Item Env:DEPLOY_TARGET -ErrorAction SilentlyContinue
  Pop-Location
}
