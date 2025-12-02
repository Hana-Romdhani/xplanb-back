import { Controller, Get, Post } from '@nestjs/common';
import { AdminSetupService } from './admin-setup.service';

@Controller('admin')
export class AdminSetupController {
  constructor(private readonly adminSetupService: AdminSetupService) {}

  @Post('create-admin')
  async createAdmin() {
    return this.adminSetupService.createAdminUser();
  }

  @Get('credentials')
  async getCredentials() {
    return this.adminSetupService.getAdminCredentials();
  }
}
