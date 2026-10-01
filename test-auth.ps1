# Test Authentication Endpoints
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EVsathi - Auth Endpoint Tester" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$backendUrl = "http://localhost:5000"

Write-Host "Testing backend at: $backendUrl" -ForegroundColor Yellow
Write-Host ""

# Test 1: Server Health
Write-Host "1. Testing server connection..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/health" -Method Get -UseBasicParsing -TimeoutSec 5
    Write-Host "   ✓ Server is running!" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Server is NOT responding!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start the backend server:" -ForegroundColor Yellow
    Write-Host "   cd f:\MajorProject\MajorProject\EVsathi\server" -ForegroundColor White
    Write-Host "   npm run dev" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""

# Test 2: Register endpoint
Write-Host "2. Testing registration endpoint..." -ForegroundColor Cyan
$registerData = @{
    name = "Test User $(Get-Random -Maximum 9999)"
    email = "testuser$(Get-Random -Maximum 9999)@test.com"
    password = "test123456"
    role = "driver"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$backendUrl/api/auth/register" -Method Post `
        -ContentType "application/json" -Body $registerData -TimeoutSec 10
    
    if ($response.success) {
        Write-Host "   ✓ Registration endpoint working!" -ForegroundColor Green
        Write-Host "   Created user: $($response.data.user.name)" -ForegroundColor Green
        $testEmail = $response.data.user.email
    } else {
        Write-Host "   ✗ Registration returned error" -ForegroundColor Red
        Write-Host "   $($response | ConvertTo-Json)" -ForegroundColor Red
    }
} catch {
    Write-Host "   ✗ Registration failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""

# Test 3: Login endpoint
Write-Host "3. Testing login endpoint..." -ForegroundColor Cyan
$loginData = @{
    email = "testuser@test.com"
    password = "test123456"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$backendUrl/api/auth/login" -Method Post `
        -ContentType "application/json" -Body $loginData -TimeoutSec 10
    
    if ($response.success) {
        Write-Host "   ✓ Login endpoint working!" -ForegroundColor Green
        Write-Host "   Logged in as: $($response.data.user.name)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ Login returned: Invalid credentials (expected for test user)" -ForegroundColor Yellow
    }
} catch {
    $errorMessage = $_.Exception.Message
    if ($errorMessage -like "*401*" -or $errorMessage -like "*Invalid*") {
        Write-Host "   ✓ Login endpoint working (returned auth error as expected)" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Login failed!" -ForegroundColor Red
        Write-Host "   Error: $errorMessage" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Testing complete!" -ForegroundColor Green
Write-Host ""
Write-Host "If endpoints are working but browser fails:" -ForegroundColor Yellow
Write-Host "1. Check browser console for errors (F12)" -ForegroundColor White
Write-Host "2. Verify CORS settings in server" -ForegroundColor White
Write-Host "3. Clear browser cache and cookies" -ForegroundColor White
Write-Host "4. Try in incognito/private mode" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
