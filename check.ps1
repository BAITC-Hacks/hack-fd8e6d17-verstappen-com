# Проверить всё и запустить приложение из PowerShell. Аргументы передаются в check.sh:
#   .\check.ps1              — проверить и запустить
#   .\check.ps1 --no-serve   — только проверить
#   .\check.ps1 --quick      — только тесты и сборка
. "$PSScriptRoot\scripts\bash.ps1"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"
& $bash "$PSScriptRoot/check.sh" @args
exit $LASTEXITCODE
