#!/bin/bash

# Script de démarrage pour XPlanB en mode développement
# Démarre le backend et le frontend avec les bonnes configurations

echo "🚀 Starting XPlanB Development Environment"
echo "=========================================="

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de logging
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️${NC} $1"
}

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Vérifier que npm est installé
if ! command -v npm &> /dev/null; then
    log_error "npm is not installed. Please install npm first."
    exit 1
fi

# Vérifier la version de Node.js
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    log_warning "Node.js version $NODE_VERSION detected. Recommended version is 16 or higher."
fi

# Fonction pour vérifier si un port est utilisé
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Vérifier les ports
log "Checking ports..."

if check_port 3000; then
    log_warning "Port 3000 is already in use. Backend might already be running."
fi

if check_port 5173; then
    log_warning "Port 5173 is already in use. Frontend might already be running."
fi

# Vérifier les variables d'environnement
log "Checking environment variables..."

if [ ! -f ".env" ]; then
    log_warning ".env file not found. Creating a sample .env file..."
    cat > .env << EOF
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
EOF
    log_success "Sample .env file created. Please update the values as needed."
fi

# Vérifier que MongoDB est accessible
log "Checking MongoDB connection..."
if ! command -v mongosh &> /dev/null && ! command -v mongo &> /dev/null; then
    log_warning "MongoDB client not found. Please make sure MongoDB is installed and running."
else
    log_success "MongoDB client found."
fi

# Installer les dépendances si nécessaire
log "Checking dependencies..."

if [ ! -d "node_modules" ]; then
    log "Installing backend dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        log_success "Backend dependencies installed successfully."
    else
        log_error "Failed to install backend dependencies."
        exit 1
    fi
else
    log_success "Backend dependencies already installed."
fi

# Vérifier les dépendances frontend
if [ ! -d "../app_frontend_xplanb-master/node_modules" ]; then
    log "Installing frontend dependencies..."
    cd ../app_frontend_xplanb-master
    npm install
    if [ $? -eq 0 ]; then
        log_success "Frontend dependencies installed successfully."
        cd ../app_backend_xplanb-master
    else
        log_error "Failed to install frontend dependencies."
        exit 1
    fi
else
    log_success "Frontend dependencies already installed."
fi

# Fonction pour démarrer le backend
start_backend() {
    log "Starting backend server..."
    npm run start:dev &
    BACKEND_PID=$!
    echo $BACKEND_PID > .backend.pid
    log_success "Backend started with PID $BACKEND_PID"
}

# Fonction pour démarrer le frontend
start_frontend() {
    log "Starting frontend server..."
    cd ../app_frontend_xplanb-master
    npm run dev &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > .frontend.pid
    cd ../app_backend_xplanb-master
    log_success "Frontend started with PID $FRONTEND_PID"
}

# Fonction pour arrêter les processus
cleanup() {
    log "Stopping servers..."
    
    if [ -f ".backend.pid" ]; then
        BACKEND_PID=$(cat .backend.pid)
        if kill -0 $BACKEND_PID 2>/dev/null; then
            kill $BACKEND_PID
            log_success "Backend stopped (PID: $BACKEND_PID)"
        fi
        rm .backend.pid
    fi
    
    if [ -f "../app_frontend_xplanb-master/.frontend.pid" ]; then
        FRONTEND_PID=$(cat ../app_frontend_xplanb-master/.frontend.pid)
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            kill $FRONTEND_PID
            log_success "Frontend stopped (PID: $FRONTEND_PID)"
        fi
        rm ../app_frontend_xplanb-master/.frontend.pid
    fi
    
    exit 0
}

# Capturer les signaux d'arrêt
trap cleanup SIGINT SIGTERM

# Démarrer les serveurs
start_backend

# Attendre que le backend soit prêt
log "Waiting for backend to be ready..."
sleep 5

# Vérifier que le backend répond
for i in {1..30}; do
    if curl -s http://localhost:3000/health >/dev/null 2>&1; then
        log_success "Backend is ready!"
        break
    fi
    
    if [ $i -eq 30 ]; then
        log_error "Backend failed to start or is not responding."
        cleanup
        exit 1
    fi
    
    sleep 1
done

start_frontend

# Attendre que le frontend soit prêt
log "Waiting for frontend to be ready..."
sleep 5

# Vérifier que le frontend répond
for i in {1..30}; do
    if curl -s http://localhost:5173 >/dev/null 2>&1; then
        log_success "Frontend is ready!"
        break
    fi
    
    if [ $i -eq 30 ]; then
        log_warning "Frontend might not be ready yet, but continuing..."
        break
    fi
    
    sleep 1
done

# Afficher les informations de connexion
echo ""
echo "🎉 XPlanB Development Environment is running!"
echo "============================================="
echo ""
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend API: http://localhost:3000"
echo "🔌 WebSocket: ws://localhost:3000/ws/docs"
echo ""
echo "📚 Documentation:"
echo "   - Integration Guide: ./INTEGRATION_GUIDE.md"
echo "   - Backend Tests: node test-integration.js"
echo "   - Frontend Tests: open ../app_frontend_xplanb-master/test-frontend.html"
echo ""
echo "🛠️  Available Commands:"
echo "   - Backend logs: tail -f logs/application.log"
echo "   - Stop servers: Ctrl+C"
echo "   - Restart backend: kill \$(cat .backend.pid) && npm run start:dev"
echo "   - Restart frontend: kill \$(cat ../app_frontend_xplanb-master/.frontend.pid) && cd ../app_frontend_xplanb-master && npm run dev"
echo ""
echo "🔍 Testing Real-time Collaboration:"
echo "   1. Open http://localhost:5173 in two different browser tabs"
echo "   2. Open the same document in both tabs"
echo "   3. Start typing in one tab and see changes in the other"
echo ""

# Attendre indéfiniment
log "Press Ctrl+C to stop all servers..."
wait
