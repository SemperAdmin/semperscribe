<#
    probe-gemini-cors.ps1

    Decides WHY GunnyBot cannot reach Google Gemini from the DoD network,
    with no browser console and no local checkout required. Runs against
    the DEPLOYED app's origin.

    BASELINE, measured from a clean network on 2026-08-10:

      https://semperscribe.app.cloud.gov  -> HTTP 200, no CSP header set

      OPTIONS preflight to Google, Origin https://semperscribe.app.cloud.gov
        HTTP 200
        access-control-allow-origin : https://semperscribe.app.cloud.gov
        access-control-allow-headers: content-type,x-goog-api-key
        access-control-allow-methods: DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT
        access-control-max-age      : 3600

      POST to Google, even with a bad key
        HTTP 400
        access-control-allow-origin : https://semperscribe.app.cloud.gov

    Chrome needs the allow-origin header on BOTH the preflight and the
    POST. A proxy that passes traffic while stripping access-control-*
    headers leaves PowerShell working and Chrome refusing. A plain
    reachability test scores that case as healthy and misses it entirely.

    The key is read hidden, never printed, and nothing is written to disk.

  .EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\probe-gemini-cors.ps1

  .EXAMPLE
    # GitHub Pages copy instead of cloud.gov
    .\probe-gemini-cors.ps1 -Origin 'https://semperadmin.github.io'
#>
#Requires -Version 5.1
param(
    [string]$Origin  = 'https://semperscribe.app.cloud.gov',
    [string]$AppHost = 'semperscribe.app.cloud.gov'
)

$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Net.Http
try {
    [Net.ServicePointManager]::SecurityProtocol =
        [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {}

$GHOST = 'generativelanguage.googleapis.com'
$GURL  = "https://$GHOST/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse"

function Write-Head($t) { Write-Host ''; Write-Host "=== $t ===" -ForegroundColor Cyan }

function Test-Host($name) {
    $r = [ordered]@{ dns = $false; tcp = $false; issuer = '' }
    try {
        $ips = [System.Net.Dns]::GetHostAddresses($name) | ForEach-Object { $_.IPAddressToString }
        Write-Host "  $name resolves to: $($ips -join ', ')"
        $r.dns = $true
    } catch { Write-Host "  $name DNS FAILED: $($_.Exception.Message)" -ForegroundColor Red; return $r }
    try {
        $t = New-Object System.Net.Sockets.TcpClient
        if ($t.ConnectAsync($name, 443).Wait(8000)) { Write-Host "  $name tcp 443: open"; $r.tcp = $true }
        else { Write-Host "  $name tcp 443: TIMED OUT" -ForegroundColor Red }
        $t.Close()
    } catch { Write-Host "  $name tcp 443 FAILED: $($_.Exception.Message)" -ForegroundColor Red; return $r }
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient($name, 443)
        $ssl = New-Object System.Net.Security.SslStream($tcp.GetStream(), $false, ({ $true } -as [System.Net.Security.RemoteCertificateValidationCallback]))
        $ssl.AuthenticateAsClient($name)
        $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
        $r.issuer = $cert.Issuer
        Write-Host "  $name TLS issuer: $($cert.Issuer)"
        $ssl.Close(); $tcp.Close()
    } catch { Write-Host "  $name TLS handshake FAILED: $($_.Exception.Message)" -ForegroundColor Red }
    return $r
}

# ------------------------------------------------------------------ 1. proxy
Write-Head '1. Effective system proxy'
try {
    $p = [System.Net.WebRequest]::GetSystemWebProxy().GetProxy([Uri]"https://$GHOST")
    if ($p.AbsoluteUri -like "*$GHOST*") { Write-Host '  direct, no proxy for Google' }
    else { Write-Host "  proxy for Google: $($p.AbsoluteUri)" }
} catch { Write-Host "  proxy lookup failed: $($_.Exception.Message)" }

# ----------------------------------------------- 2. the decisive comparison
Write-Head '2. Can this machine reach the APP but not GOOGLE?'
Write-Host '  This contrast is the whole diagnosis. A network that reaches .gov'
Write-Host '  and refuses commercial hosts is the documented MCEN pattern.'
Write-Host ''
$app = Test-Host $AppHost
Write-Host ''
$goog = Test-Host $GHOST

# --------------------------------------------------------------- http client
$handler = New-Object System.Net.Http.HttpClientHandler
try {
    $handler.UseProxy = $true
    $handler.Proxy = [System.Net.WebRequest]::GetSystemWebProxy()
    $handler.Proxy.Credentials = [System.Net.CredentialCache]::DefaultCredentials
} catch {}
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds(30)

function Show-Cors($resp, $label) {
    Write-Host "  $label status: $([int]$resp.StatusCode) $($resp.StatusCode)"
    $found = @()
    foreach ($h in $resp.Headers)         { if ($h.Key -like 'access-control-*') { $found += "    $($h.Key): $($h.Value -join ',')" } }
    foreach ($h in $resp.Content.Headers) { if ($h.Key -like 'access-control-*') { $found += "    $($h.Key): $($h.Value -join ',')" } }
    if ($found.Count -eq 0) {
        Write-Host '    NO access-control-* HEADERS PRESENT' -ForegroundColor Red
        return $false
    }
    $found | ForEach-Object { Write-Host $_ }
    return $true
}

# ------------------------------------------------------------- 3. app loads
Write-Head "3. Does the deployed app itself load, and does it set a CSP?"
try {
    $resp = $client.GetAsync("https://$AppHost/").GetAwaiter().GetResult()
    Write-Host "  status: $([int]$resp.StatusCode)"
    $csp = $null
    foreach ($h in $resp.Headers) { if ($h.Key -like 'content-security-policy*') { $csp = $h.Value -join ',' } }
    if ($csp) { Write-Host "  CSP PRESENT: $csp" -ForegroundColor Yellow }
    else { Write-Host '  no CSP header, matching the clean-network baseline' }
} catch { Write-Host "  app fetch FAILED: $($_.Exception.Message)" -ForegroundColor Red }

# -------------------------------------------------------------- 4. preflight
Write-Head "4. Anonymous CORS preflight to Google, Origin $Origin"
$preflightOk = $false
try {
    $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Options, $GURL)
    $req.Headers.TryAddWithoutValidation('Origin', $Origin) | Out-Null
    $req.Headers.TryAddWithoutValidation('Access-Control-Request-Method', 'POST') | Out-Null
    $req.Headers.TryAddWithoutValidation('Access-Control-Request-Headers', 'content-type,x-goog-api-key') | Out-Null
    $resp = $client.SendAsync($req).GetAwaiter().GetResult()
    $preflightOk = (Show-Cors $resp 'preflight') -and ([int]$resp.StatusCode -lt 300)
} catch { Write-Host "  preflight FAILED at transport: $($_.Exception.Message)" -ForegroundColor Red }

# -------------------------------------------------------- 5. post, bad key
Write-Head '5. POST with a deliberately bad key (headers matter, not the body)'
$postCorsOk = $false
try {
    $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, $GURL)
    $req.Headers.TryAddWithoutValidation('Origin', $Origin) | Out-Null
    $req.Headers.TryAddWithoutValidation('x-goog-api-key', 'invalid-key-for-header-probe') | Out-Null
    $req.Content = New-Object System.Net.Http.StringContent('{"contents":[{"role":"user","parts":[{"text":"hi"}]}]}', [Text.Encoding]::UTF8, 'application/json')
    $resp = $client.SendAsync($req).GetAwaiter().GetResult()
    $postCorsOk = Show-Cors $resp 'post'
} catch { Write-Host "  POST FAILED at transport: $($_.Exception.Message)" -ForegroundColor Red }

# ------------------------------------------------------- 6. post, real key
Write-Head '6. POST with your real key (proves the key and the full round trip)'
$sec = Read-Host -AsSecureString 'Paste your Gemini API key (hidden, never printed)'
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
$realOk = $false
try {
    $req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, $GURL)
    $req.Headers.TryAddWithoutValidation('Origin', $Origin) | Out-Null
    $req.Headers.TryAddWithoutValidation('x-goog-api-key', $key) | Out-Null
    $req.Content = New-Object System.Net.Http.StringContent('{"contents":[{"role":"user","parts":[{"text":"Reply with the single word: ready"}]}],"generationConfig":{"maxOutputTokens":256}}', [Text.Encoding]::UTF8, 'application/json')
    $resp = $client.SendAsync($req).GetAwaiter().GetResult()
    [void](Show-Cors $resp 'real')
    $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    Write-Host "  body bytes: $($body.Length)"
    if ($body.Length -gt 0) {
        $safe = $body.Substring(0, [Math]::Min(300, $body.Length))
        Write-Host "  first 300 chars: $safe"
    }
    $realOk = ([int]$resp.StatusCode -eq 200 -and $body -match '"text"')
} catch { Write-Host "  real POST FAILED at transport: $($_.Exception.Message)" -ForegroundColor Red }
finally { $key = $null; [GC]::Collect() }

# --------------------------------------------------------------- 7. verdict
Write-Head '7. VERDICT'
if ($app.tcp -and -not $goog.tcp) {
    Write-Host '  MCEN reaches cloud.gov and blocks Google at the network layer.' -ForegroundColor Yellow
    Write-Host '  The app loads, the API call dies. No code change in SemperScribe fixes this.'
    Write-Host '  Model IDs are irrelevant. The ask goes to whoever runs the MCEN proxy,'
    Write-Host '  or GunnyBot needs a DoD-hosted relay.'
} elseif (-not $realOk -and -not $preflightOk) {
    Write-Host '  Google is unreachable from this machine at the HTTP layer.' -ForegroundColor Yellow
    Write-Host '  Same conclusion: not a SemperScribe defect.'
} elseif ($realOk -and -not $postCorsOk) {
    Write-Host '  THE PROXY STRIPS access-control-* HEADERS.' -ForegroundColor Yellow
    Write-Host '  PowerShell succeeds, Chrome refuses. This is exactly the split you report.'
    Write-Host '  No client-side fix exists.'
} elseif ($realOk -and $postCorsOk) {
    Write-Host '  Network, key, and CORS are all healthy from this machine.' -ForegroundColor Green
    Write-Host '  The failure is NOT transport. Check the Provider dropdown in the app:'
    Write-Host '  gemini-2.5-flash is the default model ID for GenAI.mil as well as Google,'
    Write-Host '  and a GenAI.mil selection fails for the reason already documented.'
} else {
    Write-Host '  Mixed result. Send the whole output above.'
}
Write-Host ''
