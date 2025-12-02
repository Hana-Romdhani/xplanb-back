import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateUserInput } from 'src/users/dto/createUserDto';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { LoginUserDto } from './dto/login-user.input';
import { hash } from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { ResetPasswordInput } from 'src/users/dto/reset-password.input';
import { getAuth } from 'firebase-admin/auth';
import { app } from 'src/firebase/config';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService
  ) {}

  async signup(input: CreateUserInput) {
    if (input.password !== input.confirmPassword) {
      throw new Error('Password and confirmation password do not match.');
    }

    // Create user with email verification token
    const user = await this.usersService.create(input);

    // Generate email verification token
    const verificationToken = uuidv4();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with verification token
    await this.usersService.update(user._id, {
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiry: verificationTokenExpiry,
      emailVerified: false
    });

    // Send verification email
    await this.sendVerificationEmail(user.email, verificationToken);

    return {
      ...user,
      message: 'Account created successfully. Please check your email to verify your account.'
    };
  }
  private _createToken(user: { email: string; role: string[]; id: string }, expiresIn = '1d') {
    const token = this.jwtService.sign(user, {
      expiresIn
    });
    return {
      expiresIn,
      token
    };
  }
  async login(loginUserDto: LoginUserDto) {
    const user = await this.usersService.login(loginUserDto);
    const token = this._createToken({
      id: user._id,
      email: user.email,
      role: user.accountType
    });

    return {
      token,
      data: user
    };
  }
  async resetPassword(input: ResetPasswordInput) {
    const user = await this.usersService.findOneByResetToken(input.token);

    if (input.password !== input.confirmNewPassword) {
      throw new Error('New password and confirmation do not match.');
    }

    if (!user) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }
    if (!user?.resetTokenExpiry || user?.resetTokenExpiry < new Date()) {
      throw new HttpException('Password reset token expired', HttpStatus.BAD_REQUEST);
    }
    const hashedPassword = await hash(input.password, 0);
    return this.usersService.resetPassword(user._id, hashedPassword);
  }

  async forgetPassword(email: string) {
    const user = await this.usersService.findOneByEmailWithPassword(email);
    if (!user) {
      // Don't reveal if user exists for security - return success message
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
        resetUrl: null,
        userName: null,
        email: email
      };
    }
    const token = uuidv4();
    const PROCESS_URL =
      process.env.PROCESS_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetPasswordUrl = `${PROCESS_URL}/reset-password/${token}`;

    // Save reset token to user
    const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
    await this.usersService.update(user._id, {
      resetToken: token,
      resetTokenExpiry
    });

    // Return reset URL and user info for frontend to send email
    const userName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined;

    return {
      success: true,
      message: 'Password reset link generated',
      resetUrl: resetPasswordUrl,
      userName: userName,
      email: email
    };
  }
  async loginWithGoogle(googleUuid: string) {
    const user = await getAuth(app).getUser(googleUuid);
    const newUser = await this.usersService.findOneByEmailWithPassword(user.email || '');
    if (!newUser) {
      throw new Error('You don t have an account');
    }
    const token = this._createToken({
      id: newUser._id,
      email: newUser.email,
      role: newUser.accountType
    });

    return {
      token,
      data: newUser
    };
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    try {
      const PROCESS_URL =
        process.env.PROCESS_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      const verificationUrl = `${PROCESS_URL}/verify-email/${token}`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f7fafc; border-radius: 10px; border: 1px solid #e6e8ec; padding: 32px;">
          <h2 style="margin-top: 0; color: #2150e9;">Welcome to XPlanB!</h2>
          <p style="font-size: 1.06em;">Thank you for signing up. Please verify your email address by clicking the button below:</p>
          <p style="margin: 28px 0 14px 0;">
            <a href="${verificationUrl}" style="display: inline-block; background: #1546cf; color: #fff; padding: 12px 28px; border-radius: 7px; text-decoration: none; font-weight: bold;">Verify Email</a>
          </p>
          <p style="margin-top:24px; color:#7b88a8; font-size:0.97em;">If the button doesn't work, copy and paste this link in your browser:<br/><a href="${verificationUrl}">${verificationUrl}</a></p>
          <hr style="border:none; border-top:1px solid #e6e8ec; margin:28px 0 12px 0" />
          <div style="font-size: 0.96em; color: #6a768a;">⏰ This link expires in 24 hours. If you didn't create an account, please ignore this email.<br/>Best regards,<br/>XPlanB Team</div>
        </div>
      `;
      const text = `Welcome to XPlanB!\n\nThank you for signing up. Please verify your email address:\n${verificationUrl}\n\nThis link expires in 24 hours.\n\n— XPlanB Team`;

      await this.emailService.sendEmail({
        to: email,
        subject: 'Verify your email address - XPlanB',
        html,
        text
      });
      console.log('✅ Verification email sent successfully via Resend to:', email);
    } catch (error) {
      console.error('❌ Failed to send verification email via Resend:', error);
      const PROCESS_URL =
        process.env.PROCESS_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      console.log(
        `⚠️ Fallback: Verification URL for ${email}: ${PROCESS_URL}/verify-email/${token}`
      );
      // Don't throw error to allow signup to proceed
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.usersService.findOneByVerificationToken(token);

      if (!user) {
        return { success: false, message: 'Invalid verification token' };
      }

      if (!user.emailVerificationTokenExpiry || user.emailVerificationTokenExpiry < new Date()) {
        return { success: false, message: 'Verification token has expired' };
      }

      if (user.emailVerified) {
        return { success: false, message: 'Email already verified' };
      }

      // Update user as verified
      await this.usersService.update(user._id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null
      });

      return { success: true, message: 'Email verified successfully' };
    } catch (error) {
      console.error('Email verification error:', error);
      return { success: false, message: 'Failed to verify email' };
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.usersService.findOneByEmail(email);

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      if (user.emailVerified) {
        return { success: false, message: 'Email already verified' };
      }

      // Generate new verification token
      const verificationToken = uuidv4();
      const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update user with new verification token
      await this.usersService.update(user._id, {
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiry: verificationTokenExpiry
      });

      // Send verification email
      await this.sendVerificationEmail(user.email, verificationToken);

      return { success: true, message: 'Verification email sent successfully' };
    } catch (error) {
      console.error('Resend verification email error:', error);
      return { success: false, message: 'Failed to resend verification email' };
    }
  }
}
