# probe-genaimil-bases.ps1
#
# Server-side CORS probe for BOTH GenAI.mil base URLs.
#
# WHY POWERSHELL. A browser no-cors row proves a response came back and
# hides the status, so it cannot tell a live gateway from a 503 network
# block page. PowerShell reads the status line and the headers directly.
# Run this on a GOVERNMENT workstation on the government network.
#
# The key is read as a SecureString so it never lands in the transcript
# or the console history.
#
# Lines are kept short on purpose. Long lines truncate on paste in the
# PowerShell 5.1 console and leave the prompt hanging at >>.

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Origin = 'https://semperscribe.app.cloud.gov'

$hostA = 'https://api.genai.mil'
$hostB = 'https://genai.mil/stark/api'

function Show-Result {
  param($Label, $Resp, $ErrText)

  Write-Host ''
  Write-Host "=== $Label ===" -ForegroundColor Cyan

  if (-not $Resp) {
    Write-Host "NO RESPONSE. error: $ErrText" -ForegroundColor Red
    return
  }

  $code = [int]$Resp.StatusCode
  Write-Host "status : $code $($Resp.StatusDescription)"

  $acao = $null
  $srv  = $null
  try { $acao = $Resp.Headers['Access-Control-Allow-Origin'] } catch {}
  try { $srv  = $Resp.Headers['Server'] } catch {}

  if ($acao) {
    Write-Host "ACAO   : $acao" -ForegroundColor Green
  } else {
    Write-Host "ACAO   : (ABSENT)" -ForegroundColor Yellow
  }
  if ($srv) { Write-Host "server : $srv" }

  # A 503 from a network appliance is the block page, not the gateway.
  # Calling that a CORS finding would be wrong.
  if ($code -eq 503) {
    Write-Host "NOTE   : 503. This is very likely the network block page," -ForegroundColor Red
    Write-Host "         NOT the API gateway. Every CORS conclusion from" -ForegroundColor Red
    Write-Host "         this row is void. You are off the fenced network." -ForegroundColor Red
  }
}

function Invoke-Probe {
  param($Label, $Uri, $Method, $Headers)

  $resp = $null
  $err  = ''
  try {
    $resp = Invoke-WebRequest -Uri $Uri -Method $Method `
              -Headers $Headers -UseBasicParsing -TimeoutSec 20
  } catch {
    # PowerShell 5.1 throws on any 4xx or 5xx. The response is still
    # on the exception and is exactly what we need to read.
    $err = $_.Exception.Message
    if ($_.Exception.Response) { $resp = $_.Exception.Response }
  }
  Show-Result -Label $Label -Resp $resp -ErrText $err
}

Write-Host 'Paste your GenAI.mil API key. It stays out of the transcript.'
$sec = Read-Host -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$key  = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

$auth = @{ 'Authorization' = "Bearer $key" }

$pre = @{
  'Origin'                         = $Origin
  'Access-Control-Request-Method'  = 'POST'
  'Access-Control-Request-Headers' = 'authorization,content-type'
}

# ---- Base B, the documented base. This is the open question. ----

$u = $hostB + '/v1/models'
Invoke-Probe -Label 'B: GET /v1/models, authenticated' `
  -Uri $u -Method GET -Headers $auth

$u = $hostB + '/v1/chat/completions'
Invoke-Probe -Label 'B: anonymous OPTIONS preflight' `
  -Uri $u -Method OPTIONS -Headers $pre

# ---- Base A, for comparison against the 6 August measurement. ----

$u = $hostA + '/v1/models'
Invoke-Probe -Label 'A: GET /v1/models, authenticated' `
  -Uri $u -Method GET -Headers $auth

$u = $hostA + '/v1/chat/completions'
Invoke-Probe -Label 'A: anonymous OPTIONS preflight' `
  -Uri $u -Method OPTIONS -Headers $pre

$key = $null

Write-Host ''
Write-Host 'HOW TO READ THIS' -ForegroundColor Cyan
Write-Host '- Any 503 means you are off the fenced network. Stop and'
Write-Host '  re-run from a government workstation. Nothing else counts.'
Write-Host '- On the authenticated GET rows, 200 or 401 both prove the'
Write-Host '  host and path are real. Read the ACAO line, not the status.'
Write-Host '- ACAO ABSENT on a 200 is defect 2, confirmed server side.'
Write-Host '- A non-2xx on the OPTIONS row is defect 1.'
Write-Host '- ACAO present on BOTH rows for a base means that base works'
Write-Host '  from a browser and the app is pointed at the wrong host.'
