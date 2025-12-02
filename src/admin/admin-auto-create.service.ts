import { Injectable, OnModuleInit } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminAutoCreateService implements OnModuleInit {
  constructor(private readonly usersService: UsersService) {}

  async onModuleInit() {
    await this.createAdminUserIfNotExists();
  }

  private async createAdminUserIfNotExists() {
    const adminEmail = 'admin@xplanb.com';
    const adminPassword = 'Admin123!';

    try {
      console.log('🔧 Checking for admin user...');

      // Check if admin already exists
      const existingAdmin = await this.usersService.findOneByEmail(adminEmail);

      if (existingAdmin) {
        console.log('✅ Admin user already exists');
        console.log('📧 Email:', adminEmail);
        console.log('👤 Role:', existingAdmin.accountType);
        return;
      }

      // Create admin user
      console.log('🔧 Creating admin user...');
      const adminUser = await this.usersService.create({
        firstName: 'Admin',
        lastName: 'User',
        email: adminEmail,
        password: adminPassword,
        confirmPassword: adminPassword,
        accountType: ['ADMIN'],
        gender: 'Male'
      });

      console.log('✅ Admin user created successfully!');
      console.log('📧 Email:', adminEmail);
      console.log('🔑 Password:', adminPassword);
      console.log('👤 Role: ADMIN');
      console.log('🆔 User ID:', adminUser._id);
      console.log('');
      console.log('🎯 Admin Features Available:');
      console.log('   ✅ View all user complaints');
      console.log('   ✅ Update complaint status');
      console.log('   ✅ Access system-wide analytics');
      console.log('   ✅ Monitor user activity logs');
      console.log('   ✅ Manage user permissions');
      console.log('');
      console.log('🌐 Login at: http://localhost:5173');
    } catch (error) {
      console.error('❌ Error creating admin user:', error.message);
    }
  }
}
