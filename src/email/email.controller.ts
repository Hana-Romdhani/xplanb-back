import { Controller, Post, Body, HttpException, HttpStatus, Get, Query } from '@nestjs/common';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';

@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  @Post('send')
  async sendEmail(
    @Body() emailData: { to: string | string[]; subject: string; html: string; text?: string }
  ) {
    try {
      if (!emailData.to || !emailData.subject || !emailData.html) {
        throw new HttpException(
          'Missing required fields: to, subject, or html',
          HttpStatus.BAD_REQUEST
        );
      }

      console.log('📧 Email proxy request received:', {
        to: emailData.to,
        subject: emailData.subject
      });

      const toField = Array.isArray(emailData.to)
        ? (emailData.to as string[]).join(',')
        : (emailData.to as string);
      const payload = {
        to: toField,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text
      };

      const result = await this.emailService.sendEmail(payload as any);
      console.log('✅ Email sent successfully via proxy');
      return { success: true, data: result };
    } catch (error: any) {
      console.error('❌ Email proxy error:', error);
      console.error('Error details:', error?.message, error?.response?.data);

      // Return proper error response
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMessage =
        error?.message || error?.response?.data?.message || 'Failed to send email';
      throw new HttpException(
        { message: errorMessage, details: error?.response?.data },
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('test')
  async sendTestEmail(@Query('to') to?: string) {
    const recipient =
      to ||
      this.configService.get<string>('RESEND_TEST_EMAIL') ||
      this.configService.get<string>('BREVO_FROM') ||
      'you@example.com';

    const emailData = {
      to: recipient,
      subject: 'XPlanB — Test Email',
      html: `<p>Ceci est un email de test envoyé depuis l'API XPlanB.</p>`,
      text: `Ceci est un email de test depuis XPlanB.`
    };

    try {
      const result = await this.emailService.sendEmail(emailData as any);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('❌ Test email error:', error);
      const errorMessage = error?.message || 'Failed to send test email';
      throw new HttpException(
        { message: errorMessage },
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
