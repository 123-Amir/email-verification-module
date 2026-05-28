Write-Host "`n===== EMAIL VERIFICATION API - TEST RESULTS =====`n" -ForegroundColor Green

$baseUrl = "http://localhost:3000"

# Test 1: API Info
Write-Host "[TEST 1] API Info Endpoint" -ForegroundColor Cyan
$response = Invoke-WebRequest -Uri "$baseUrl/" -UseBasicParsing
Write-Host $response.Content
Write-Host ""

# Test 2: Syntax Validation - Invalid
Write-Host "[TEST 2] Syntax Validation - Invalid Email (double dots)" -ForegroundColor Cyan
$response = Invoke-WebRequest -Uri "$baseUrl/syntax?email=invalid..email@test.com" -UseBasicParsing
Write-Host $response.Content
Write-Host ""

# Test 3: Syntax Validation - Valid
Write-Host "[TEST 3] Syntax Validation - Valid Email" -ForegroundColor Cyan
$response = Invoke-WebRequest -Uri "$baseUrl/syntax?email=john@example.com" -UseBasicParsing
Write-Host $response.Content
Write-Host ""

# Test 4: Typo Detection - gmial.com
Write-Host "[TEST 4] Typo Detection - gmial.com typo" -ForegroundColor Cyan
$response = Invoke-WebRequest -Uri "$baseUrl/typo?email=user@gmial.com" -UseBasicParsing
Write-Host $response.Content
Write-Host ""

# Test 5: Typo Detection - hotmial.com
Write-Host "[TEST 5] Typo Detection - hotmial.com typo" -ForegroundColor Cyan
$response = Invoke-WebRequest -Uri "$baseUrl/typo?email=alice@hotmial.com" -UseBasicParsing
Write-Host $response.Content
Write-Host ""

# Test 6: Typo Detection - No typo
Write-Host "[TEST 6] Typo Detection - No typo (correct domain)" -ForegroundColor Cyan
$response = Invoke-WebRequest -Uri "$baseUrl/typo?email=user@gmail.com" -UseBasicParsing
Write-Host $response.Content
Write-Host ""

# Test 7: Verify - Non-existent domain
Write-Host "[TEST 7] Full Verification - Non-existent domain" -ForegroundColor Cyan
$response = Invoke-WebRequest -Uri "$baseUrl/verify?email=user@nonexistent-domain-xyz123.com" -UseBasicParsing
Write-Host $response.Content
Write-Host ""

# Test 8: Invalid email format
Write-Host "[TEST 8] Full Verification - Multiple @ symbols" -ForegroundColor Cyan
$response = Invoke-WebRequest -Uri "$baseUrl/verify?email=user@@example.com" -UseBasicParsing
Write-Host $response.Content
Write-Host ""

Write-Host "===== ALL TESTS COMPLETED =====" -ForegroundColor Green
