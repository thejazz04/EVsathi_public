# Generate Diverse Demand Data and Restart ML Service
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EVsathi - Generate Data & Restart ML" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "Step 1: Generating diverse demand data..." -ForegroundColor Yellow
Write-Host ""

# Run the data generation script
python scripts/generate_diverse_demand.py

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "✗ Data generation failed!" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "Step 2: Starting ML Service..." -ForegroundColor Yellow
Write-Host ""
Write-Host "ML Service will load the new diverse demand data" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the service" -ForegroundColor Yellow
Write-Host ""
Write-Host "Service available at:" -ForegroundColor Green
Write-Host "  - Health: http://localhost:8000/health" -ForegroundColor White
Write-Host "  - Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""

# Start ML service
python -m api.main --host 0.0.0.0 --port 8000
