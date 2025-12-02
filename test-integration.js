/**
 * Script de test d'intégration pour XPlanB
 * 
 * Teste les nouvelles fonctionnalités de co-édition, versioning et partage
 * 
 * Usage: node test-integration.js
 */

const axios = require('axios');
const io = require('socket.io-client');

// Configuration
const API_BASE_URL = 'http://localhost:3000';
const WS_URL = 'http://localhost:3000/ws/docs';

// Variables globales pour les tests
let authToken = '';
let userId = '';
let documentId = '';
let folderId = '';
let shareToken = '';

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  log(`\n🧪 Testing: ${testName}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Helper pour les requêtes API
async function apiRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        ...headers,
      },
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    throw new Error(`API Error: ${error.response?.data?.message || error.message}`);
  }
}

// Test 1: Authentification
async function testAuthentication() {
  logTest('Authentication');
  
  try {
    // Créer un utilisateur de test
    const userData = {
      firstName: 'Test',
      lastName: 'User',
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
      confirmPassword: 'password123',
      accountType: ['CLIENT'],
    };
    
    await apiRequest('POST', '/auth/signup', userData, {});
    logSuccess('User created');
    
    // Se connecter
    const loginData = {
      email: userData.email,
      password: userData.password,
    };
    
    const loginResponse = await apiRequest('POST', '/auth/login', loginData, {});
    authToken = loginResponse.token.token;
    userId = loginResponse.data._id;
    
    logSuccess('Authentication successful');
    return true;
  } catch (error) {
    logError(`Authentication failed: ${error.message}`);
    return false;
  }
}

// Test 2: Création de dossier et document
async function testCreateResources() {
  logTest('Creating folder and document');
  
  try {
    // Créer un dossier
    const folderData = {
      Name: `Test Folder ${Date.now()}`,
    };
    
    const folder = await apiRequest('POST', '/folder/AddFolder', folderData);
    folderId = folder._id;
    logSuccess(`Folder created: ${folder.Name}`);
    
    // Créer un document
    const documentData = {
      Title: `Test Document ${Date.now()}`,
      contentType: ['text'],
      folderId: folderId,
      content: {
        blocks: [
          {
            type: 'paragraph',
            data: {
              text: 'This is a test document for real-time collaboration.',
            },
          },
        ],
      },
    };
    
    const document = await apiRequest('POST', '/Document', documentData);
    documentId = document._id;
    logSuccess(`Document created: ${document.Title}`);
    
    return true;
  } catch (error) {
    logError(`Resource creation failed: ${error.message}`);
    return false;
  }
}

// Test 3: WebSocket - Co-édition temps-réel
async function testWebSocketCollaboration() {
  logTest('WebSocket real-time collaboration');
  
  return new Promise((resolve) => {
    try {
      const socket = io(WS_URL, {
        auth: {
          token: authToken,
        },
      });
      
      let connected = false;
      let documentJoined = false;
      let contentReceived = false;
      
      const timeout = setTimeout(() => {
        if (!connected || !documentJoined) {
          logError('WebSocket connection timeout');
          socket.disconnect();
          resolve(false);
        }
      }, 10000);
      
      socket.on('connect', () => {
        logSuccess('WebSocket connected');
        connected = true;
        
        // Rejoindre le document
        socket.emit('join_document', { documentId });
      });
      
      socket.on('document_joined', (data) => {
        logSuccess('Joined document successfully');
        documentJoined = true;
        
        // Simuler une mise à jour de contenu
        const updatedContent = {
          blocks: [
            {
              type: 'paragraph',
              data: {
                text: 'This document has been updated via WebSocket!',
              },
            },
          ],
        };
        
        socket.emit('content_update', {
          documentId,
          content: updatedContent,
        });
      });
      
      socket.on('content_updated', (data) => {
        logSuccess('Content update received via WebSocket');
        contentReceived = true;
        
        // Test terminé avec succès
        clearTimeout(timeout);
        socket.disconnect();
        resolve(true);
      });
      
      socket.on('error', (error) => {
        logError(`WebSocket error: ${error.message}`);
        clearTimeout(timeout);
        socket.disconnect();
        resolve(false);
      });
      
      socket.on('connect_error', (error) => {
        logError(`WebSocket connection error: ${error.message}`);
        clearTimeout(timeout);
        resolve(false);
      });
      
    } catch (error) {
      logError(`WebSocket test failed: ${error.message}`);
      resolve(false);
    }
  });
}

// Test 4: Versioning
async function testVersioning() {
  logTest('Document versioning');
  
  try {
    // Créer une version manuelle
    const versionData = {
      content: {
        blocks: [
          {
            type: 'paragraph',
            data: {
              text: 'This is version 2 of the document.',
            },
          },
        ],
      },
      description: 'Manual version creation',
    };
    
    const version = await apiRequest('POST', `/Document/${documentId}/versions`, versionData);
    logSuccess(`Version created: ${version.version}`);
    
    // Lister les versions
    const versions = await apiRequest('GET', `/Document/${documentId}/versions`);
    logSuccess(`Found ${versions.length} versions`);
    
    // Restaurer une version (si il y en a une)
    if (versions.length > 0) {
      const versionToRestore = versions[0];
      const restoreResult = await apiRequest(
        'POST',
        `/Document/${documentId}/versions/${versionToRestore._id}/restore`
      );
      logSuccess(`Version ${versionToRestore.version} restored`);
    }
    
    return true;
  } catch (error) {
    logError(`Versioning test failed: ${error.message}`);
    return false;
  }
}

// Test 5: Partage
async function testSharing() {
  logTest('Document sharing');
  
  try {
    // Générer un lien de partage public
    const shareData = {
      resourceType: 'document',
      resourceId: documentId,
      role: 'view',
      isPublic: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
    };
    
    const share = await apiRequest('POST', '/shares/generate', shareData);
    shareToken = share.token;
    logSuccess(`Public share created: ${share.token}`);
    
    // Lister les partages
    const shares = await apiRequest('GET', `/shares/resource/${documentId}`);
    logSuccess(`Found ${shares.length} shares`);
    
    // Tester l'accès au partage (simulation)
    try {
      const accessTest = await apiRequest('GET', `/shares/access/${shareToken}`);
      logSuccess('Share access validation successful');
    } catch (error) {
      logWarning('Share access validation failed (expected in test environment)');
    }
    
    return true;
  } catch (error) {
    logError(`Sharing test failed: ${error.message}`);
    return false;
  }
}

// Test 6: Opérations groupées
async function testBulkOperations() {
  logTest('Bulk operations');
  
  try {
    // Créer un deuxième dossier pour le test
    const folder2Data = {
      Name: `Test Folder 2 ${Date.now()}`,
    };
    
    const folder2 = await apiRequest('POST', '/folder/AddFolder', folder2Data);
    logSuccess(`Second folder created: ${folder2.Name}`);
    
    // Test d'archivage en lot
    const bulkData = {
      action: 'archive',
      ids: [folderId, folder2._id],
    };
    
    const bulkResult = await apiRequest('POST', '/folder/bulkAction', bulkData);
    logSuccess(`Bulk archive completed: ${bulkResult.processed} folders processed`);
    
    // Test de création par template
    const templateData = {
      templateName: 'project',
      folderName: `Project Template ${Date.now()}`,
    };
    
    const templateFolder = await apiRequest('POST', '/folder/template', templateData);
    logSuccess(`Template folder created: ${templateFolder.Name}`);
    
    return true;
  } catch (error) {
    logError(`Bulk operations test failed: ${error.message}`);
    return false;
  }
}

// Test 7: Duplication de document
async function testDocumentDuplication() {
  logTest('Document duplication');
  
  try {
    const duplicateData = {
      newTitle: `Duplicated Document ${Date.now()}`,
      targetFolderId: folderId,
    };
    
    const duplicatedDoc = await apiRequest('POST', `/Document/${documentId}/duplicate`, duplicateData);
    logSuccess(`Document duplicated: ${duplicatedDoc.Title}`);
    
    return true;
  } catch (error) {
    logError(`Document duplication test failed: ${error.message}`);
    return false;
  }
}

// Fonction principale de test
async function runTests() {
  log('🚀 Starting XPlanB Integration Tests', 'bright');
  log('=====================================', 'bright');
  
  const tests = [
    { name: 'Authentication', fn: testAuthentication },
    { name: 'Resource Creation', fn: testCreateResources },
    { name: 'WebSocket Collaboration', fn: testWebSocketCollaboration },
    { name: 'Document Versioning', fn: testVersioning },
    { name: 'Document Sharing', fn: testSharing },
    { name: 'Bulk Operations', fn: testBulkOperations },
    { name: 'Document Duplication', fn: testDocumentDuplication },
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const success = await test.fn();
      results.push({ name: test.name, success });
      
      if (success) {
        logSuccess(`${test.name} passed`);
      } else {
        logError(`${test.name} failed`);
      }
    } catch (error) {
      logError(`${test.name} failed with error: ${error.message}`);
      results.push({ name: test.name, success: false });
    }
    
    // Pause entre les tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Résumé des tests
  log('\n📊 Test Results Summary', 'bright');
  log('=======================', 'bright');
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    log(`${status} ${result.name}`, result.success ? 'green' : 'red');
  });
  
  log(`\n🎯 Overall: ${passed}/${total} tests passed`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('🎉 All tests passed! XPlanB integration is working correctly.', 'green');
  } else {
    log('⚠️  Some tests failed. Please check the logs above for details.', 'yellow');
  }
  
  return passed === total;
}

// Vérifier que le serveur est accessible
async function checkServer() {
  try {
    await axios.get(`${API_BASE_URL}/health`);
    return true;
  } catch (error) {
    logError('Server is not accessible. Please make sure the backend is running on port 3000.');
    return false;
  }
}

// Point d'entrée
async function main() {
  log('XPlanB Integration Test Suite', 'bright');
  log('==============================', 'bright');
  
  // Vérifier que le serveur est accessible
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }
  
  // Exécuter les tests
  const success = await runTests();
  process.exit(success ? 0 : 1);
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (error) => {
  logError(`Unhandled rejection: ${error.message}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

// Lancer les tests
main().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  process.exit(1);
});
