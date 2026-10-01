$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$launcherPath = Join-Path $PSScriptRoot 'launch-desktop.ps1'
$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath 'Xon Music.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $launcherPath + '"'
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = 'Xon Music — private piano listening and practice'
$shortcut.WindowStyle = 7
$chromePath = Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'
if (Test-Path -LiteralPath $chromePath) { $shortcut.IconLocation = "$chromePath,0" }
$shortcut.Save()
$saved = $shell.CreateShortcut($shortcutPath)
if (-not (Test-Path -LiteralPath $saved.TargetPath) -or $saved.Arguments -notlike '*launch-desktop.ps1*') {
    throw 'Desktop shortcut validation failed.'
}
Write-Output "Created and verified: $shortcutPath"
