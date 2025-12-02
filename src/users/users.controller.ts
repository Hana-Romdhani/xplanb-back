import { Controller, Get, Body, Param, Put, Delete, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserInput } from './dto/createUserDto';
import { UserWithoutPassword } from './users.repository';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('create-admin')
  async createAdmin() {
    const adminEmail = 'admin@xplanb.com';
    const adminPassword = 'Admin123!';

    try {
      // Check if admin already exists
      const existingAdmin = await this.usersService.findOneByEmail(adminEmail);
      if (existingAdmin) {
        return {
          success: true,
          message: 'Admin user already exists',
          email: adminEmail,
          password: adminPassword
        };
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

      return {
        success: true,
        message: 'Admin user created successfully',
        email: adminEmail,
        password: adminPassword,
        userId: adminUser._id
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error creating admin user: ' + error.message
      };
    }
  }

  @Get()
  async findAll(): Promise<UserWithoutPassword[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<UserWithoutPassword | null> {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: CreateUserInput
  ): Promise<UserWithoutPassword> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
