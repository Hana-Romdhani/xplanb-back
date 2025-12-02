import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth/2fa')
@UseGuards(JwtAuthGuard)
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Post('generate')
  async generateSecret(@Request() req) {
    return this.twoFactorService.generateSecret(req.user.id);
  }

  @Post('verify')
  async verifyToken(@Request() req, @Body() body: { token: string }) {
    const isValid = await this.twoFactorService.verifyToken(req.user.id, body.token);
    return { valid: isValid };
  }

  @Post('enable')
  async enableTwoFactor(@Request() req, @Body() body: { token: string }) {
    return this.twoFactorService.enableTwoFactor(req.user.id, body.token);
  }

  @Post('disable')
  async disableTwoFactor(@Request() req, @Body() body: { token: string }) {
    await this.twoFactorService.disableTwoFactor(req.user.id, body.token);
    return { message: 'Two-factor authentication disabled successfully' };
  }

  @Post('verify-backup')
  async verifyBackupCode(@Request() req, @Body() body: { backupCode: string }) {
    const isValid = await this.twoFactorService.verifyBackupCode(req.user.id, body.backupCode);
    return { valid: isValid };
  }

  @Post('regenerate-backup-codes')
  async regenerateBackupCodes(@Request() req, @Body() body: { token: string }) {
    return this.twoFactorService.regenerateBackupCodes(req.user.id, body.token);
  }

  @Get('test-token')
  async generateTestToken(@Request() req) {
    return this.twoFactorService.generateTestToken(req.user.id);
  }
}
