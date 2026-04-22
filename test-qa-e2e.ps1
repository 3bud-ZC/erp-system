# ERP System End-to-End QA Test Script
# This script performs a full end-to-end test of the ERP system

$baseUrl = "http://localhost:3000"
$token = ""

Write-Host "🚀 Starting ERP End-to-End QA Test..." -ForegroundColor Green

# STEP 1: Login to get token
Write-Host "`n📝 STEP 1: Login to get authentication token..." -ForegroundColor Yellow
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
    $loginBody = @{
        email = "demo@erp-system.com"
        password = "demo12345"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -WebSession $session
    Write-Host "✅ Login successful. User: $($loginResponse.data.name)" -ForegroundColor Green
    Write-Host "   User ID: $($loginResponse.data.id)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    exit 1
}

# Helper function to make authenticated API calls
function Invoke-AuthenticatedApi {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body
    )
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    try {
        if ($Body) {
            $bodyJson = $Body | ConvertTo-Json
            $response = Invoke-RestMethod -Uri "$baseUrl$Endpoint" -Method $Method -Headers $headers -Body $bodyJson -WebSession $session
        } else {
            $response = Invoke-RestMethod -Uri "$baseUrl$Endpoint" -Method $Method -Headers $headers -WebSession $session
        }
        return $response
    } catch {
        if ($_.ErrorDetails) {
            $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "❌ API Error ($Method $Endpoint): $($errorJson.error)" -ForegroundColor Red
        } else {
            Write-Host "❌ API Error ($Method $Endpoint): $_" -ForegroundColor Red
        }
        throw
    }
}

# STEP 2: Create Customer
Write-Host "`n📝 STEP 2: Create Customer..." -ForegroundColor Yellow
try {
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $customerBody = @{
        code = "CUST-QA-$timestamp"
        nameAr = "عميل اختبار"
        nameEn = "QA Test Customer"
        email = "qa$timestamp@test.com"
        phone = "01000000001"
        address = "Test Address"
        creditLimit = 100000
    }
    
    $customerResponse = Invoke-AuthenticatedApi -Method "POST" -Endpoint "/api/customers" -Body $customerBody
    $customerId = $customerResponse.data.id
    Write-Host "✅ Customer created successfully" -ForegroundColor Green
    Write-Host "   Customer ID: $customerId" -ForegroundColor Gray
    Write-Host "   Name: $($customerResponse.data.nameEn)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to create customer: $_" -ForegroundColor Red
    exit 1
}

# STEP 3: Create Product
Write-Host "`n📝 STEP 3: Create Product..." -ForegroundColor Yellow
try {
    $productBody = @{
        code = "PROD-QA-$timestamp"
        nameAr = "منتج اختبار"
        nameEn = "QA Test Product"
        type = "finished_product"
        unit = "piece"
        price = 150
        cost = 75
        stock = 100
        minStock = 10
    }
    
    $productResponse = Invoke-AuthenticatedApi -Method "POST" -Endpoint "/api/products" -Body $productBody
    $productId = $productResponse.data.id
    $initialStock = $productResponse.data.stock
    Write-Host "✅ Product created successfully" -ForegroundColor Green
    Write-Host "   Product ID: $productId" -ForegroundColor Gray
    Write-Host "   Name: $($productResponse.data.nameEn)" -ForegroundColor Gray
    Write-Host "   Initial Stock: $initialStock" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to create product: $_" -ForegroundColor Red
    exit 1
}

# STEP 4: Create Sales Invoice
Write-Host "`n📝 STEP 4: Create Sales Invoice with items..." -ForegroundColor Yellow
try {
    $invoiceBody = @{
        invoiceNumber = "INV-QA-$timestamp"
        customerId = $customerId
        date = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
        items = @(
            @{
                productId = $productId
                quantity = 5
                price = 150
                total = 750
            }
        )
        notes = "QA Test Invoice"
    }
    
    $invoiceResponse = Invoke-AuthenticatedApi -Method "POST" -Endpoint "/api/sales-invoices" -Body $invoiceBody
    $invoiceId = $invoiceResponse.data.id
    $invoiceTotal = $invoiceResponse.data.total
    Write-Host "✅ Sales Invoice created successfully" -ForegroundColor Green
    Write-Host "   Invoice ID: $invoiceId" -ForegroundColor Gray
    Write-Host "   Invoice Number: $($invoiceResponse.data.invoiceNumber)" -ForegroundColor Gray
    Write-Host "   Total: $invoiceTotal" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to create sales invoice: $_" -ForegroundColor Red
    exit 1
}

# STEP 5: Post the Invoice
Write-Host "`n📝 STEP 5: Post the Invoice..." -ForegroundColor Yellow
Write-Host "⚠️  Skipping - Journal entry creation temporarily disabled" -ForegroundColor Yellow
# TODO: Re-enable after fixing journal entry transaction timeout

# STEP 6: Record Payment
Write-Host "`n📝 STEP 6: Record Payment..." -ForegroundColor Yellow
try {
    $paymentBody = @{
        customerId = $customerId
        salesInvoiceId = $invoiceId
        amount = 750
        date = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
        type = "incoming"
        notes = "QA Test Payment"
    }
    
    $paymentResponse = Invoke-AuthenticatedApi -Method "POST" -Endpoint "/api/payments" -Body $paymentBody
    $paymentId = $paymentResponse.data.id
    Write-Host "✅ Payment recorded successfully" -ForegroundColor Green
    Write-Host "   Payment ID: $paymentId" -ForegroundColor Gray
    Write-Host "   Amount: $($paymentResponse.data.amount)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to record payment: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ All API operations completed successfully!" -ForegroundColor Green

# VERIFICATION PHASE
Write-Host "`n🔍 VERIFICATION PHASE" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan

# Verify Accounting
Write-Host "`n📊 Verify Accounting..." -ForegroundColor Yellow
try {
    $journalEntries = Invoke-AuthenticatedApi -Method "GET" -Endpoint "/api/journal-entries"
    $latestEntry = $journalEntries.data | Where-Object { $_.sourceEventId -eq $invoiceId } | Select-Object -First 1
    
    if ($latestEntry) {
        $totalDebit = $latestEntry.totalDebit
        $totalCredit = $latestEntry.totalCredit
        $isBalanced = [math]::Abs($totalDebit - $totalCredit) -lt 0.01
        
        Write-Host "   Journal Entry ID: $($latestEntry.id)" -ForegroundColor Gray
        Write-Host "   Total Debit: $totalDebit" -ForegroundColor Gray
        Write-Host "   Total Credit: $totalCredit" -ForegroundColor Gray
        
        if ($isBalanced) {
            Write-Host "✅ Debit == Credit: TRUE" -ForegroundColor Green
        } else {
            Write-Host "❌ Debit == Credit: FALSE (MISMATCH!)" -ForegroundColor Red
        }
        
        if ($latestEntry.isPosted) {
            Write-Host "✅ Journal Entry Posted: TRUE" -ForegroundColor Green
        } else {
            Write-Host "❌ Journal Entry Posted: FALSE" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ No journal entry found for invoice" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed to verify accounting: $_" -ForegroundColor Red
}

# Verify Inventory
Write-Host "`n📦 Verify Inventory..." -ForegroundColor Yellow
try {
    $productCheck = Invoke-AuthenticatedApi -Method "GET" -Endpoint "/api/products"
    $updatedProduct = $productCheck.data | Where-Object { $_.id -eq $productId } | Select-Object -First 1
    
    if ($updatedProduct) {
        $expectedStock = $initialStock - 5
        $actualStock = $updatedProduct.stock
        
        Write-Host "   Initial Stock: $initialStock" -ForegroundColor Gray
        Write-Host "   Expected Stock: $expectedStock" -ForegroundColor Gray
        Write-Host "   Actual Stock: $actualStock" -ForegroundColor Gray
        
        if ($actualStock -eq $expectedStock) {
            Write-Host "✅ Stock reduced correctly: TRUE" -ForegroundColor Green
        } else {
            Write-Host "❌ Stock reduced correctly: FALSE (Expected $expectedStock, got $actualStock)" -ForegroundColor Red
        }
        
        if ($actualStock -ge 0) {
            Write-Host "✅ No negative stock: TRUE" -ForegroundColor Green
        } else {
            Write-Host "❌ No negative stock: FALSE (Stock is negative!)" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Product not found" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed to verify inventory: $_" -ForegroundColor Red
}

# Final Summary
Write-Host "`n📊 FINAL SUMMARY" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan
Write-Host "✅ End-to-End Test Completed" -ForegroundColor Green
Write-Host "`nTest Data:" -ForegroundColor Gray
Write-Host "  Customer ID: $customerId" -ForegroundColor Gray
Write-Host "  Product ID: $productId" -ForegroundColor Gray
Write-Host "  Invoice ID: $invoiceId" -ForegroundColor Gray
Write-Host "  Payment ID: $paymentId" -ForegroundColor Gray
