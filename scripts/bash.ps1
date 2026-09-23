# Находит bash из Git for Windows (не WSL-овский C:\Windows\System32\bash.exe).
$candidates = @(
    "$env:ProgramFiles\Git\bin\bash.exe",
    "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe"
)
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if ($gitCmd) {
    $candidates += Join-Path (Split-Path (Split-Path $gitCmd.Source)) "bin\bash.exe"
}
$bash = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $bash) {
    Write-Host "Не найден Git Bash. Установите Git for Windows: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}
