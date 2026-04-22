# PowerShell script to fix all API routes - Add tenantId
# Run: .\scripts\fix-all-api-routes.ps1

$ErrorActionPreference = "Continue"

$apiRoutes = @(
    "api\accounts\route.ts",
    "api\batches\route.ts", 
    "api\bom\route.ts",
    "api\companies\route.ts",
    "api\expenses\route.ts",
    "api\fixed-assets\route.ts",
    "api\goods-receipts\route.ts",
    "api\item-groups\route.ts",
    "api\journal-entries\route.ts",
    "api\payments\route.ts",
    "api\production-lines\route.ts",
    "api\production-lines\assignments\route.ts",
    "api\production-orders\route.ts",
    "api\purchase-invoices\route.ts",
    "api\purchase-orders\route.ts",
    "api\purchase-requisitions\route.ts",
    "api\quotations\route.ts",
    "api\sales-invoices\route.ts",
    "api\sales-orders\route.ts",
    "api\sales-returns\route.ts",
    "api\stock-adjustments\route.ts",
    "api\stock-transfers\route.ts",
    "api\stocktakes\route.ts",
    "api\suppliers\route.ts",
    "api\units\route.ts",
    "api\accruals\route.ts",
    "api\accounting-periods\route.ts"
)

$tenantIdCheck = @"

    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }
"@

$fixedCount = 0
$skippedCount = 0
$errorCount = 0

foreach ($route in $apiRoutes) {
    $fullPath = Join-Path (Get-Location) "app\$route"
    
    if (-not (Test-Path $fullPath)) {
        Write-Host "⚠️  Not found: $route" -ForegroundColor Yellow
        $skippedCount++
        continue
    }
    
    try {
        $content = Get-Content $fullPath -Raw -Encoding UTF8
        
        # Check if already fixed
        if ($content -match "user\.tenantId") {
            Write-Host "✅ Already fixed: $route" -ForegroundColor Green
            $skippedCount++
            continue
        }
        
        # Find prisma model name
        $modelMatch = [regex]::Match($content, "prisma\.(\w+)\.create\(")
        if (-not $modelMatch.Success) {
            Write-Host "⏭️  No create operation: $route" -ForegroundColor Gray
            $skippedCount++
            continue
        }
        
        $modelName = $modelMatch.Groups[1].Value
        Write-Host "🔧 Fixing: $route (model: $modelName)" -ForegroundColor Cyan
        
        # Pattern to find: data: body or data: { ... }
        $oldPattern = "(const body = await request\.json\(\);\s*\r?\n\s*const \w+ = await prisma\.$modelName\.create\(\{\s*\r?\n\s*)data:\s*(\w+),"
        $newReplacement = "`${1}data: { ...`${2}, tenantId: user.tenantId },"
        
        # Try to fix the file
        $newContent = $content -replace $oldPattern, $newReplacement
        
        # Add tenant check after permission check
        $permissionPattern = "(if \(!checkPermission\(user, ['\`]([^'`]+)['\`]\)\) \{\s*\r?\n\s*return apiError\([^)]+\);\s*\r?\n\s*\})"
        $newContent = $newContent -replace $permissionPattern, "`$1\n\n    if (!user.tenantId) {\n      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);\n    }"
        
        if ($newContent -ne $content) {
            Set-Content $fullPath $newContent -Encoding UTF8 -NoNewline
            Write-Host "✅ Fixed: $route" -ForegroundColor Green
            $fixedCount++
        } else {
            Write-Host "⚠️  Could not auto-fix: $route (needs manual review)" -ForegroundColor Yellow
            $errorCount++
        }
        
    } catch {
        Write-Host "❌ Error: $route - $_" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "Summary:" -ForegroundColor Blue
Write-Host "  Fixed: $fixedCount files" -ForegroundColor Green
Write-Host "  Skipped: $skippedCount files" -ForegroundColor Yellow
Write-Host "  Errors: $errorCount files" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""
Write-Host "Run 'npm run build' to apply changes" -ForegroundColor Cyan
