Write-Host "🚀 XPlanB Admin User Creation (Direct MongoDB)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Admin Credentials:" -ForegroundColor Yellow
Write-Host "📧 Email: admin@xplanb.com" -ForegroundColor White
Write-Host "🔑 Password: Admin123!" -ForegroundColor White
Write-Host "👤 Role: ADMIN" -ForegroundColor White
Write-Host ""

Write-Host "🔧 Creating admin user directly in MongoDB..." -ForegroundColor Green

try {
    # Try to run MongoDB command
    $result = mongo --eval "db.users.insertOne({firstName: 'Admin', lastName: 'User', email: 'admin@xplanb.com', password: '\$2b\$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', accountType: ['ADMIN'], gender: ['Male'], twoFactorEnabled: false, createdAt: new Date(), updatedAt: new Date()}); print('✅ Admin user created successfully!');"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host $result -ForegroundColor Green
    } else {
        Write-Host "❌ MongoDB command failed. Please run manually:" -ForegroundColor Red
        Write-Host ""
        Write-Host "📝 Manual MongoDB Commands:" -ForegroundColor Yellow
        Write-Host "1. Open MongoDB shell or MongoDB Compass" -ForegroundColor White
        Write-Host "2. Connect to your database" -ForegroundColor White
        Write-Host "3. Run this command:" -ForegroundColor White
        Write-Host ""
        Write-Host "db.users.insertOne({" -ForegroundColor Cyan
        Write-Host "  firstName: 'Admin'," -ForegroundColor Cyan
        Write-Host "  lastName: 'User'," -ForegroundColor Cyan
        Write-Host "  email: 'admin@xplanb.com'," -ForegroundColor Cyan
        Write-Host "  password: '\$2b\$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'," -ForegroundColor Cyan
        Write-Host "  accountType: ['ADMIN']," -ForegroundColor Cyan
        Write-Host "  gender: ['Male']," -ForegroundColor Cyan
        Write-Host "  twoFactorEnabled: false," -ForegroundColor Cyan
        Write-Host "  createdAt: new Date()," -ForegroundColor Cyan
        Write-Host "  updatedAt: new Date()" -ForegroundColor Cyan
        Write-Host "});" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Make sure MongoDB is running and accessible" -ForegroundColor Yellow
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
