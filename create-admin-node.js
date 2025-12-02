const { MongoClient } = require('mongodb');

async function createAdminUser() {
  console.log('🚀 XPlanB Admin User Creation');
  console.log('================================\n');

  console.log('📋 Admin Credentials:');
  console.log('📧 Email: admin@xplanb.com');
  console.log('🔑 Password: Admin123!');
  console.log('👤 Role: ADMIN\n');

  // MongoDB connection URL - adjust as needed
  const url = 'mongodb://localhost:27017';
  const dbName = 'xplanb'; // Adjust database name as needed

  try {
    console.log('🔧 Connecting to MongoDB...');
    const client = new MongoClient(url);
    await client.connect();
    
    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    // Check if admin already exists
    const existingAdmin = await usersCollection.findOne({ email: 'admin@xplanb.com' });
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists!');
      console.log('📧 Email:', existingAdmin.email);
      console.log('👤 Role:', existingAdmin.accountType);
      console.log('🆔 User ID:', existingAdmin._id);
    } else {
      console.log('🔧 Creating new admin user...');
      
      const adminUser = {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@xplanb.com',
        password: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // Admin123!
        accountType: ['ADMIN'],
        gender: 'Male',
        twoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await usersCollection.insertOne(adminUser);
      
      if (result.insertedId) {
        console.log('✅ Admin user created successfully!');
        console.log('📧 Email: admin@xplanb.com');
        console.log('🔑 Password: Admin123!');
        console.log('👤 Role: ADMIN');
        console.log('🆔 User ID:', result.insertedId);
      } else {
        console.log('❌ Failed to create admin user');
      }
    }

    await client.close();
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('\n💡 Make sure MongoDB is running and accessible');
    console.log('   You can also run the MongoDB commands manually:');
    console.log('   See ADMIN-CREATION-INSTRUCTIONS.txt');
  }

  console.log('\n🎯 Admin Features Available:');
  console.log('   ✅ View all user complaints');
  console.log('   ✅ Update complaint status');
  console.log('   ✅ Access system-wide analytics');
  console.log('   ✅ Monitor user activity logs');
  console.log('   ✅ Manage user permissions\n');
  
  console.log('🌐 Login at: http://localhost:5173');
}

createAdminUser();
