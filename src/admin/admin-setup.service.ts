import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminSetupService {
  constructor(private readonly usersService: UsersService) {}

  async createAdminUser() {
    const adminEmail = 'admin@xplanb.com';
    const adminPassword = 'Admin123!';

    try {
      // Check if admin already exists
      const existingAdmin = await this.usersService.findOneByEmail(adminEmail);
      if (existingAdmin) {
        console.log('Admin user already exists');
        return existingAdmin;
      }

      // Create admin user
      const adminUser = await this.usersService.create({
        firstName: 'Admin',
        lastName: 'User',
        email: adminEmail,
        password: adminPassword,
        confirmPassword: adminPassword,
        accountType: ['ADMIN'],
        gender: 'Male'
      });

      console.log('Admin user created successfully');
      console.log(`Email: ${adminEmail}`);
      console.log(`Password: ${adminPassword}`);

      return adminUser;
    } catch (error) {
      console.error('Error creating admin user:', error);
      throw error;
    }
  }

  async getAdminCredentials() {
    return {
      email: 'admin@xplanb.com',
      password: 'Admin123!',
      instructions: 'Use these credentials to login as admin and access admin features'
    };
  }
}
