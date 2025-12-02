const http = require('http');

console.log('🚀 XPlanB Admin User Creation');
console.log('================================\n');

console.log('📋 Admin Credentials:');
console.log('📧 Email: admin@xplanb.com');
console.log('🔑 Password: Admin123!');
console.log('👤 Role: ADMIN\n');

console.log('🔧 Creating admin user...');

// Make HTTP request to create admin
const postData = JSON.stringify({});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/auth/create-admin',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.success) {
        console.log('✅ ' + result.message);
        console.log('📧 Email: ' + result.email);
        console.log('🔑 Password: ' + result.password);
        if (result.userId) {
          console.log('🆔 User ID: ' + result.userId);
        }
      } else {
        console.log('❌ ' + result.message);
      }
    } catch (error) {
      console.log('❌ Error parsing response:', error.message);
      console.log('Raw response:', data);
    }
    
    console.log('\n🎯 Admin Features Available:');
    console.log('   ✅ View all user complaints');
    console.log('   ✅ Update complaint status');
    console.log('   ✅ Access system-wide analytics');
    console.log('   ✅ Monitor user activity logs');
    console.log('   ✅ Manage user permissions\n');
    
    console.log('🌐 Login at: http://localhost:5173');
  });
});

req.on('error', (error) => {
  console.log('❌ Error creating admin user:', error.message);
  console.log('\n💡 Make sure your backend server is running:');
  console.log('   npm run start:dev');
});

req.write(postData);
req.end();
