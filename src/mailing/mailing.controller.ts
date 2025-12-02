import { MailingService } from './mailing.service';
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('mailing')
@UseGuards(JwtAuthGuard)
export class MailingController {
  constructor(private readonly mailingService: MailingService) {}

  @Get()
  async sendTestEmail(@Request() req): Promise<{ success: boolean; message: string }> {
    try {
      const recipient_email = 'h97625093@gmail.com';
      const subject = 'Test Email from XPlanB';
      const message = 'This is a test email to verify email functionality.';
      const userId = req.user.id;

      const result = await this.mailingService.sendEmail(recipient_email, subject, message, userId);
      return {
        success: true,
        message: result
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to send test email'
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('send_email')
  async sendEmail(@Body() body, @Request() req): Promise<{ success: boolean; message: string }> {
    try {
      const { recipient_email, subject, message } = body;

      // Validate input
      if (!recipient_email || !subject || !message) {
        throw new HttpException(
          {
            success: false,
            message: 'Missing required fields: recipient_email, subject, and message are required'
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipient_email)) {
        throw new HttpException(
          {
            success: false,
            message: 'Invalid email address format'
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const userId = req.user.id;
      const result = await this.mailingService.sendEmail(recipient_email, subject, message, userId);

      return {
        success: true,
        message: result
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to send email'
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
