@echo off
echo 🚀 XPlanB Admin User Creation
echo ================================
echo.

echo 📋 Admin Credentials:
echo 📧 Email: admin@xplanb.com
echo 🔑 Password: Admin123!
echo 👤 Role: ADMIN
echo.

echo 🔧 How to create the admin user:
echo 1. Start your backend server:
echo    npm run start:dev
echo.

echo 2. In another terminal, run one of these commands:
echo    Option A - Using curl:
echo    curl -X POST http://localhost:3000/admin/create-admin
echo.

echo    Option B - Using PowerShell:
echo    Invoke-RestMethod -Uri "http://localhost:3000/admin/create-admin" -Method POST
echo.

echo    Option C - Using PowerShell script:
echo    .\create-admin.ps1
echo.

echo 3. Or simply register manually:
echo    - Go to your registration page
echo    - Use email: admin@xplanb.com
echo    - Use password: Admin123!
echo    - Then update the user role to ADMIN in the database
echo.

echo 🎯 Admin Features Available:
echo    ✅ View all user complaints
echo    ✅ Update complaint status
echo    ✅ Access system-wide analytics
echo    ✅ Monitor user activity logs
echo    ✅ Manage user permissions
echo.

echo 🌐 Once created, login at: http://localhost:3000
pause
