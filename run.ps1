# Запустить приложение из PowerShell. Аргументы передаются в run.sh:
#   .\run.ps1           — запуск
#   .\run.ps1 --reset   — запуск со сбросом БД к тестовым данным (перед демо)
. "$PSScriptRoot\scripts\bash.ps1"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"
& $bash "$PSScriptRoot/run.sh" @args
exit $LASTEXITCODE
