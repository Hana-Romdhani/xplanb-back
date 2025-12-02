@echo off
echo 🚀 XPlanB Admin User Creation (Direct MongoDB)
echo =============================================
echo.

echo 📋 Admin Credentials:
echo 📧 Email: admin@xplanb.com
echo 🔑 Password: Admin123!
echo 👤 Role: ADMIN
echo.

echo 🔧 Creating admin user directly in MongoDB...
echo.

REM Try to run MongoDB command
mongo --eval "db.users.insertOne({firstName: 'Admin', lastName: 'User', email: 'admin@xplanb.com', password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', accountType: ['ADMIN'], gender: ['Male'], twoFactorEnabled: false, createdAt: new Date(), updatedAt: new Date()}); print('✅ Admin user created successfully!');"

if %errorlevel% neq 0 (
    echo.
    echo ❌ MongoDB command failed. Please run manually:
    echo.
    echo 📝 Manual MongoDB Commands:
    echo 1. Open MongoDB shell or MongoDB Compass
    echo 2. Connect to your database
    echo 3. Run this command:
    echo.
    echo db.users.insertOne({
    echo   firstName: 'Admin',
    echo   lastName: 'User',
    echo   email: 'admin@xplanb.com',
    echo   password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    echo   accountType: ['ADMIN'],
    echo   gender: ['Male'],
    echo   twoFactorEnabled: false,
    echo   createdAt: new Date(),
    echo   updatedAt: new Date()
    echo });
    echo.
)

echo.
echo 🎯 Admin Features Available:
echo    ✅ View all user complaints
echo    ✅ Update complaint status
echo    ✅ Access system-wide analytics
echo    ✅ Monitor user activity logs
echo    ✅ Manage user permissions
echo.
echo 🌐 Login at: http://localhost:3000
pause
