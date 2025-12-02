import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('BREVO_HOST'),
      port: this.configService.get('BREVO_PORT'),
      auth: {
        user: this.configService.get('BREVO_USER'),
        pass: this.configService.get('BREVO_PASSWORD')
      }
    });
  }

  async sendEmail({
    to,
    subject,
    html,
    text
  }: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    return await this.transporter.sendMail({
      from: this.configService.get('BREVO_FROM'),
      to,
      subject,
      html,
      text: text || html
    });
  }
}
