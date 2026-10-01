# Test ML Service with Different Chargers
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EVsathi - ML Service Tester" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$mlServiceUrl = "http://localhost:8000"

# Test chargers
$chargers = @(
    @{id="CHG-BLR-005"; name="Bangalore Mall"},
    @{id="CHG-MYS-001"; name="Mysore Palace"},
    @{id="CHG-MYS-002"; name="Mysore Mall"},
    @{id="CHG-MYS-003"; name="Mysore Residential"},
    @{id="CHG-MYS-007"; name="Mysore Zoo"},
    @{id="CHG-MYS-009"; name="Mysore Station"}
)

Write-Host "Testing ML service at: $mlServiceUrl" -ForegroundColor Yellow
Write-Host ""

# Check health
Write-Host "1. Checking health..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "$mlServiceUrl/health" -Method Get
    Write-Host "   ✓ Status: $($health.status)" -ForegroundColor Green
    Write-Host "   ✓ Model: $($health.model_version)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "   ✗ ML service not responding!" -ForegroundColor Red
    Write-Host "   Please start the ML service first:" -ForegroundColor Yellow
    Write-Host "   cd model" -ForegroundColor White
    Write-Host "   python -m api.main --host 0.0.0.0 --port 8000" -ForegroundColor White
    exit 1
}

# Test predictions for each charger
Write-Host "2. Testing demand predictions..." -ForegroundColor Cyan
Write-Host ""

$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:00:00")

foreach ($charger in $chargers) {
    Write-Host "   Testing: $($charger.name) ($($charger.id))" -ForegroundColor Yellow
    
    $body = @{
        charger_id = $charger.id
        timestamp = $timestamp
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$mlServiceUrl/predict-demand" -Method Post `
            -ContentType "application/json" -Body $body
        
        $demand = [math]::Round($response.predicted_demand, 4)
        $demandPercent = [math]::Round($demand * 100, 1)
        
        Write-Host "     → Demand: $demand ($demandPercent%)" -ForegroundColor Green
        
    } catch {
        Write-Host "     → Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Testing complete!" -ForegroundColor Green
Write-Host ""
Write-Host "If all chargers show the same demand value:" -ForegroundColor Yellow
Write-Host "1. Run: .\generate_and_restart.ps1" -ForegroundColor White
Write-Host "2. Wait for data generation to complete" -ForegroundColor White
Write-Host "3. ML service will load diverse data automatically" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
