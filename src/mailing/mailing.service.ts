import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { UsersService } from '../users/users.service';
import { MailgunService } from '../email/mailgun.service';

@Injectable()
export class MailingService {
  private transporter: nodemailer.Transporter | null;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly mailgunService: MailgunService
  ) {
    // Initialize transporter with environment variables
    const smtpHost = this.configService.get<string>('SMTP_HOST') || 'smtp.gmail.com';
    const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
    const smtpUser = this.configService.get<string>('SMTP_USER') || 'h97625093@gmail.com';
    let smtpPass = this.configService.get<string>('SMTP_PASSWORD') || 'hnem iunp flny xrjl';
    const smtpFromEmail =
      this.configService.get<string>('SMTP_FROM_EMAIL') || 'h97625093@gmail.com';
    const smtpFromName = this.configService.get<string>('SMTP_FROM_NAME') || 'XPlanB';

    // Remove spaces from password if present
    if (smtpPass && smtpPass.includes(' ')) {
      console.warn('⚠️ SMTP password contains spaces, removing them');
      smtpPass = smtpPass.replace(/\s+/g, '');
    }

    // Only initialize if we have a password (not the default)
    if (!smtpPass || smtpPass === 'hnem iunp flny xrjl' || smtpPass.length < 10) {
      console.warn('⚠️ SMTP not configured. Email features disabled.');
      this.transporter = null;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      // Test connection (don't block startup if it fails)
      this.transporter
        .verify()
        .then(() => {
          console.log('✅ SMTP server is ready to send emails');
        })
        .catch((error) => {
          console.warn('⚠️ SMTP connection failed. Email functionality will be disabled.');
          console.warn('   Configure a valid Gmail App Password to enable emails.');
          console.warn('   See: https://support.google.com/accounts/answer/185833');
          console.warn('   Or see: RESTART_INSTRUCTIONS.md for help');
          this.transporter = null; // Disable transporter
        });
    } catch (error) {
      console.warn('⚠️ Failed to initialize SMTP. Email features disabled.');
      this.transporter = null;
    }
  }

  async sendEmail(
    recipient_email: string,
    subject: string,
    message: string,
    userId?: string
  ): Promise<string> {
    // Email verification check disabled - users can send emails without verification
    // if (userId) {
    //   const user = await this.usersService.findById(userId);
    //   if (!user) {
    //     throw new Error('User not found');
    //   }
    //
    //   if (!user.emailVerified) {
    //     throw new Error('Email verification required. Please verify your email before sending emails.');
    //   }
    // }

    // Try Mailgun first if configured
    if (this.mailgunService.isConfigured()) {
      try {
        const success = await this.mailgunService.sendEmail(recipient_email, subject, message);
        if (success) {
          console.log('✅ Email sent successfully via Mailgun to:', recipient_email);
          return 'Email sent successfully';
        }
      } catch (error) {
        console.warn('⚠️ Mailgun failed, trying SMTP...');
      }
    }

    // Fallback to SMTP
    if (!this.transporter) {
      console.warn('⚠️ Email sending disabled: No email service configured');
      console.warn('📧 Email was not sent, but the operation completed successfully.');
      console.warn('   Recipient:', recipient_email);
      console.warn('   Subject:', subject);
      return 'Email sending is disabled. Please configure Mailgun or SMTP credentials.';
    }

    const smtpFromEmail =
      this.configService.get<string>('SMTP_FROM_EMAIL') || 'h97625093@gmail.com';
    const smtpFromName = this.configService.get<string>('SMTP_FROM_NAME') || 'XPlanB';

    try {
      const mailConfigs = {
        from: `"${smtpFromName}" <${smtpFromEmail}>`,
        to: recipient_email,
        subject: subject,
        text: message,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`
      };

      const info = await this.transporter.sendMail(mailConfigs);
      console.log('✅ Email sent successfully:', info.messageId);
      return 'Email sent successfully';
    } catch (error) {
      console.error('❌ Error sending email:', error);
      throw new Error('An error occurred while sending email');
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<string> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${token}`;

    const subject = 'Verify your email address';
    const message = `
Hello,

Thank you for signing up! Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, please ignore this email.

Best regards,
XPlanB Team
    `;

    return this.sendEmail(email, subject, message);
  }
}
