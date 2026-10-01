param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$appUrl = 'http://127.0.0.1:5180/'
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$vitePath = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
$builtPage = Join-Path $projectRoot 'dist\index.html'

function Test-XonServer {
    try {
        $response = Invoke-WebRequest -Uri $appUrl -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content -match '<title>Xon Music'
    } catch { return $false }
}

if (-not (Test-Path -LiteralPath $vitePath)) {
    throw 'Dependencies are missing. Run npm install in the Xon Music folder.'
}
if (-not (Test-Path -LiteralPath $builtPage)) {
    $npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
    Push-Location -LiteralPath $projectRoot
    try {
        & $npmPath run build
        if ($LASTEXITCODE -ne 0) { throw 'The Xon Music build failed.' }
    } finally { Pop-Location }
}

if (-not (Test-XonServer)) {
    $logDirectory = Join-Path $projectRoot 'artifacts'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $arguments = @('"' + $vitePath + '"', 'preview', '--host', '127.0.0.1', '--port', '5180', '--strictPort')
    $preview = Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'desktop-server.log') -RedirectStandardError (Join-Path $logDirectory 'desktop-server-error.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (Test-XonServer) { $ready = $true; break }
        if ($preview.HasExited) { break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'Xon Music could not start on port 5180. Check artifacts/desktop-server-error.log.' }
}

if ($CheckOnly) { Write-Output "Xon Music is ready at $appUrl"; exit 0 }

$browserPaths = @(
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
)
$browserPath = $browserPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ($browserPath) {
    # The browser window is the app the user explicitly chose to open.
    Start-Process -FilePath $browserPath -ArgumentList "--app=$appUrl"
} else {
    Start-Process $appUrl
}
