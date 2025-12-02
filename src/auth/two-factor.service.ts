import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

@Injectable()
export class TwoFactorService {
  constructor(private readonly usersService: UsersService) {}

  async generateSecret(userId: string): Promise<{ secret: string; qrCodeUrl: string }> {
    const secret = speakeasy.generateSecret({
      name: 'XPlanB',
      issuer: 'XPlanB',
      length: 32
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store the secret temporarily (user needs to verify before enabling)
    await this.usersService.update(userId, {
      twoFactorSecret: secret.base32
    });

    return {
      secret: secret.base32,
      qrCodeUrl
    };
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);

    if (!user || !user.twoFactorSecret) {
      return false;
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before/after current time
      digits: 6, // Ensure 6-digit verification
      step: 30, // 30-second time step
      algorithm: 'sha1' // Use SHA1 algorithm
    });

    return verified;
  }

  async enableTwoFactor(userId: string, token: string): Promise<{ backupCodes: string[] }> {
    const isValid = await this.verifyToken(userId, token);

    if (!isValid) {
      throw new Error('Invalid verification token');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    await this.usersService.update(userId, {
      twoFactorEnabled: true,
      backupCodes
    });

    return { backupCodes };
  }

  async disableTwoFactor(userId: string, token: string): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (!user || !user.twoFactorEnabled) {
      throw new Error('Two-factor authentication is not enabled');
    }

    const isValid = await this.verifyToken(userId, token);

    if (!isValid) {
      throw new Error('Invalid verification token');
    }

    await this.usersService.update(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: undefined,
      backupCodes: undefined
    });
  }

  async verifyBackupCode(userId: string, backupCode: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);

    if (!user || !user.backupCodes) {
      return false;
    }

    const isValid = user.backupCodes.includes(backupCode);

    if (isValid) {
      // Remove used backup code
      const updatedCodes = user.backupCodes.filter((code) => code !== backupCode);
      await this.usersService.update(userId, { backupCodes: updatedCodes });
    }

    return isValid;
  }

  async regenerateBackupCodes(userId: string, token: string): Promise<{ backupCodes: string[] }> {
    const isValid = await this.verifyToken(userId, token);

    if (!isValid) {
      throw new Error('Invalid verification token');
    }

    const backupCodes = this.generateBackupCodes();

    await this.usersService.update(userId, { backupCodes });

    return { backupCodes };
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];

    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  // Helper method to generate a test token for debugging
  async generateTestToken(userId: string): Promise<string> {
    const user = await this.usersService.findById(userId);

    if (!user || !user.twoFactorSecret) {
      throw new Error('User not found or no 2FA secret');
    }

    const token = speakeasy.totp({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      digits: 6,
      step: 30,
      algorithm: 'sha1'
    });

    return token;
  }
}
