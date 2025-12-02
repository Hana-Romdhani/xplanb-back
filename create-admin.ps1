Write-Host "🚀 XPlanB Admin User Creation" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Admin Credentials:" -ForegroundColor Yellow
Write-Host "📧 Email: admin@xplanb.com" -ForegroundColor White
Write-Host "🔑 Password: Admin123!" -ForegroundColor White
Write-Host "👤 Role: ADMIN" -ForegroundColor White
Write-Host ""

Write-Host "🔧 Creating admin user..." -ForegroundColor Green

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/admin/create-admin" -Method POST
    Write-Host "✅ Admin user created successfully!" -ForegroundColor Green
    Write-Host "📧 Email: admin@xplanb.com" -ForegroundColor White
    Write-Host "🔑 Password: Admin123!" -ForegroundColor White
} catch {
    Write-Host "❌ Error creating admin user:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Make sure your backend server is running:" -ForegroundColor Yellow
    Write-Host "   npm run start:dev" -ForegroundColor White
}

Write-Host ""
Write-Host "🎯 Admin Features Available:" -ForegroundColor Yellow
Write-Host "   ✅ View all user complaints" -ForegroundColor White
Write-Host "   ✅ Update complaint status" -ForegroundColor White
Write-Host "   ✅ Access system-wide analytics" -ForegroundColor White
Write-Host "   ✅ Monitor user activity logs" -ForegroundColor White
Write-Host "   ✅ Manage user permissions" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Login at: http://localhost:3000" -ForegroundColor Cyan
