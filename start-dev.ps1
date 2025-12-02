# Script de démarrage pour XPlanB en mode développement (Windows PowerShell)
# Démarre le backend et le frontend avec les bonnes configurations

Write-Host "🚀 Starting XPlanB Development Environment" -ForegroundColor Blue
Write-Host "==========================================" -ForegroundColor Blue

# Fonction de logging
function Log-Info {
    param($Message)
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor Blue
}

function Log-Success {
    param($Message)
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] ✅ $Message" -ForegroundColor Green
}

function Log-Error {
    param($Message)
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] ❌ $Message" -ForegroundColor Red
}

function Log-Warning {
    param($Message)
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] ⚠️ $Message" -ForegroundColor Yellow
}

# Vérifier que Node.js est installé
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Log-Error "Node.js is not installed. Please install Node.js first."
    exit 1
}

# Vérifier que npm est installé
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Log-Error "npm is not installed. Please install npm first."
    exit 1
}

# Vérifier la version de Node.js
$nodeVersion = (node --version).Substring(1).Split('.')[0]
if ([int]$nodeVersion -lt 16) {
    Log-Warning "Node.js version $nodeVersion detected. Recommended version is 16 or higher."
}

# Fonction pour vérifier si un port est utilisé
function Test-Port {
    param($Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    }
    catch {
        return $false
    }
}

# Vérifier les ports
Log-Info "Checking ports..."

if (Test-Port 3000) {
    Log-Warning "Port 3000 is already in use. Backend might already be running."
}

if (Test-Port 5173) {
    Log-Warning "Port 5173 is already in use. Frontend might already be running."
}

# Vérifier les variables d'environnement
Log-Info "Checking environment variables..."

if (-not (Test-Path ".env")) {
    Log-Warning ".env file not found. Creating a sample .env file..."
    @"
# Database
DATABASE_URL=mongodb://localhost:27017/xplanb

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Email (optional)
KEY_URL=your-mailgun-key
DOMAIN=your-mailgun-domain
PROCESS_URL=http://localhost:5173
"@ | Out-File -FilePath ".env" -Encoding UTF8
    Log-Success "Sample .env file created. Please update the values as needed."
}

# Installer les dépendances si nécessaire
Log-Info "Checking dependencies..."

if (-not (Test-Path "node_modules")) {
    Log-Info "Installing backend dependencies..."
    npm install
    if ($LASTEXITCODE -eq 0) {
        Log-Success "Backend dependencies installed successfully."
    } else {
        Log-Error "Failed to install backend dependencies."
        exit 1
    }
} else {
    Log-Success "Backend dependencies already installed."
}

# Vérifier les dépendances frontend
if (-not (Test-Path "../app_frontend_xplanb-master/node_modules")) {
    Log-Info "Installing frontend dependencies..."
    Set-Location "../app_frontend_xplanb-master"
    npm install
    if ($LASTEXITCODE -eq 0) {
        Log-Success "Frontend dependencies installed successfully."
        Set-Location "../app_backend_xplanb-master"
    } else {
        Log-Error "Failed to install frontend dependencies."
        exit 1
    }
} else {
    Log-Success "Frontend dependencies already installed."
}

# Variables pour stocker les PIDs
$backendJob = $null
$frontendJob = $null

# Fonction pour démarrer le backend
function Start-Backend {
    Log-Info "Starting backend server..."
    $backendJob = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        npm run start:dev
    }
    Log-Success "Backend started with Job ID $($backendJob.Id)"
}

# Fonction pour démarrer le frontend
function Start-Frontend {
    Log-Info "Starting frontend server..."
    $frontendJob = Start-Job -ScriptBlock {
        Set-Location "$using:PWD/../app_frontend_xplanb-master"
        npm run dev
    }
    Log-Success "Frontend started with Job ID $($frontendJob.Id)"
}

# Fonction pour arrêter les processus
function Stop-Servers {
    Log-Info "Stopping servers..."
    
    if ($backendJob) {
        Stop-Job $backendJob
        Remove-Job $backendJob
        Log-Success "Backend stopped"
    }
    
    if ($frontendJob) {
        Stop-Job $frontendJob
        Remove-Job $frontendJob
        Log-Success "Frontend stopped"
    }
}

# Gestionnaire pour Ctrl+C
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Stop-Servers
}

# Démarrer les serveurs
Start-Backend

# Attendre que le backend soit prêt
Log-Info "Waiting for backend to be ready..."
Start-Sleep -Seconds 5

# Vérifier que le backend répond
for ($i = 1; $i -le 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 2 -ErrorAction Stop
        Log-Success "Backend is ready!"
        break
    }
    catch {
        if ($i -eq 30) {
            Log-Error "Backend failed to start or is not responding."
            Stop-Servers
            exit 1
        }
        Start-Sleep -Seconds 1
    }
}

Start-Frontend

# Attendre que le frontend soit prêt
Log-Info "Waiting for frontend to be ready..."
Start-Sleep -Seconds 5

# Vérifier que le frontend répond
for ($i = 1; $i -le 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -ErrorAction Stop
        Log-Success "Frontend is ready!"
        break
    }
    catch {
        if ($i -eq 30) {
            Log-Warning "Frontend might not be ready yet, but continuing..."
            break
        }
        Start-Sleep -Seconds 1
    }
}

# Afficher les informations de connexion
Write-Host ""
Write-Host "🎉 XPlanB Development Environment is running!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔧 Backend API: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔌 WebSocket: ws://localhost:3000/ws/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Yellow
Write-Host "   - Integration Guide: ./INTEGRATION_GUIDE.md" -ForegroundColor White
Write-Host "   - Backend Tests: node test-integration.js" -ForegroundColor White
Write-Host "   - Frontend Tests: open ../app_frontend_xplanb-master/test-frontend.html" -ForegroundColor White
Write-Host ""
Write-Host "🛠️  Available Commands:" -ForegroundColor Yellow
Write-Host "   - Stop servers: Ctrl+C" -ForegroundColor White
Write-Host "   - View backend logs: Receive-Job $($backendJob.Id)" -ForegroundColor White
Write-Host "   - View frontend logs: Receive-Job $($frontendJob.Id)" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Testing Real-time Collaboration:" -ForegroundColor Yellow
Write-Host "   1. Open http://localhost:5173 in two different browser tabs" -ForegroundColor White
Write-Host "   2. Open the same document in both tabs" -ForegroundColor White
Write-Host "   3. Start typing in one tab and see changes in the other" -ForegroundColor White
Write-Host ""

# Attendre indéfiniment
Log-Info "Press Ctrl+C to stop all servers..."

try {
    while ($true) {
        Start-Sleep -Seconds 1
        
        # Vérifier si les jobs sont toujours actifs
        if ($backendJob -and $backendJob.State -ne "Running") {
            Log-Warning "Backend job stopped unexpectedly"
        }
        
        if ($frontendJob -and $frontendJob.State -ne "Running") {
            Log-Warning "Frontend job stopped unexpectedly"
        }
    }
}
finally {
    Stop-Servers
}
