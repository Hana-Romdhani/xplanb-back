import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AdminSetupService } from './src/admin/admin-setup.service';

async function createAdminUser() {
  console.log('🚀 Starting admin user creation...');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const adminSetupService = app.get(AdminSetupService);
  
  try {
    const admin = await adminSetupService.createAdminUser();
    console.log('\n✅ Admin user created successfully!');
    console.log('📧 Email: admin@xplanb.com');
    console.log('🔑 Password: Admin123!');
    console.log('👤 Role: ADMIN');
    console.log('\n🚀 You can now login with these credentials to access admin features:');
    console.log('   - View all complaints');
    console.log('   - Update complaint status');
    console.log('   - Access admin-only analytics');
    console.log('   - Manage user activity logs');
    console.log('\n🌐 Start your backend server and login at: http://localhost:3000');
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.message.includes('already exists')) {
      console.log('\n✅ Admin user already exists!');
      console.log('📧 Email: admin@xplanb.com');
      console.log('🔑 Password: Admin123!');
    }
  }
  
  await app.close();
  process.exit(0);
}

createAdminUser().catch(console.error);
