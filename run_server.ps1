$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$python = "python"
if (Get-Command py -ErrorAction SilentlyContinue) {
  $python = "py"
}

Write-Host "ВибраСкоп запускается на http://localhost:8501/"
Write-Host "Чтобы остановить сервер, нажмите Ctrl+C."

if ($python -eq "py") {
  py -3 -m http.server 8501
} else {
  python -m http.server 8501
}
