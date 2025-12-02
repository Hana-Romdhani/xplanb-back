import { Body, Controller, HttpException, HttpStatus, Post, Param } from '@nestjs/common';
import { CreateUserInput } from 'src/users/dto/createUserDto';
import { UsersService } from 'src/users/users.service';
import { LoginUserDto } from './dto/login-user.input';
import { AuthService } from './auth.service';
import { EmailUserInput } from 'src/users/dto/emailUserDto';
import { ResetPasswordInput } from 'src/users/dto/reset-password.input';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService
  ) {}
  @Post('signup')
  async create(@Body() createUserDto: CreateUserInput) {
    return this.usersService.create(createUserDto);
  }
  @Post('login')
  async login(@Body() args: LoginUserDto) {
    const { email, password } = args;
    const user = await this.authService.login({ email, password });

    if (!user) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    return user;
  }
  @Post('resetPassword')
  async resetPassword(@Body() input: ResetPasswordInput) {
    return this.authService.resetPassword(input);
  }
  @Post('forgetPassword')
  async forgetPassword(@Body() input: EmailUserInput) {
    return this.authService.forgetPassword(input.email);
  }

  @Post('loginWithGoogle')
  async loginWithGoogle(@Body() body: { googleUuid: string }) {
    return this.authService.loginWithGoogle(body.googleUuid);
  }

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

  @Post('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  async resendVerificationEmail(@Body() body: { email: string }) {
    return this.authService.resendVerificationEmail(body.email);
  }
}
