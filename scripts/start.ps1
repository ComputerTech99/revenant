$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

Write-Host "==> Checking local Ollama service on http://localhost:11434 ..."
try {
    Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 2 | Out-Null
    Write-Host "    Ollama is online."
} catch {
    Write-Host "    Ollama is not reachable; Revenant will use the seeded deck and keyword-overlap grading fallback."
}

$PythonBin = Join-Path $RootDir ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonBin)) {
    $PythonBin = "python"
}

Write-Host "==> Seeding demo deck into SQLite ..."
Push-Location (Join-Path $RootDir "backend")
& $PythonBin -m app.seed
Pop-Location

Write-Host "==> Starting FastAPI backend on http://localhost:8000 ..."
$BackendProc = Start-Process -FilePath $PythonBin -ArgumentList "-m uvicorn app.main:app --reload --port 8000" -WorkingDirectory (Join-Path $RootDir "backend") -PassThru

try {
    Write-Host "==> Starting Vite frontend on http://localhost:5173 ..."
    Set-Location (Join-Path $RootDir "frontend")
    npm.cmd run dev
} finally {
    if ($BackendProc -and -not $BackendProc.HasExited) {
        Stop-Process -Id $BackendProc.Id -Force
    }
}
