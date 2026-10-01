# Restart ML Service PowerShell Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EVsathi ML Service Restart Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to model directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath
Write-Host "Working directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host ""

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.8+ and add to PATH" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "Starting ML Service on port 8000..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the service" -ForegroundColor Yellow
Write-Host ""
Write-Host "Service will be available at:" -ForegroundColor Green
Write-Host "  - Health Check: http://localhost:8000/health" -ForegroundColor White
Write-Host "  - API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""

# Start the ML service
python -m api.main --host 0.0.0.0 --port 8000
