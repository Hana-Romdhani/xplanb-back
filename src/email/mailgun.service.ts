import { Injectable } from '@nestjs/common';
import mailgun from 'mailgun.js';
import * as FormData from 'form-data';

@Injectable()
export class MailgunService {
  private mailgunClient: any;
  private domain: string;

  constructor() {
    const Mailgun = new mailgun(FormData);
    const key = process.env.KEY_URL;
    this.domain = process.env.DOMAIN || '';

    if (!key || !this.domain) {
      console.warn('⚠️ Mailgun credentials not configured.');
      this.mailgunClient = null;
    } else {
      this.mailgunClient = Mailgun.client({
        username: 'api',
        key: key
      });
      console.log('✅ Mailgun configured successfully');
    }
  }

  async sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    if (!this.mailgunClient || !this.domain) {
      console.warn('⚠️ Mailgun not configured. Email not sent.');
      return false;
    }

    try {
      const data = {
        from: process.env.SMTP_FROM_EMAIL || 'XPlanB <noreply@xplanb.com>',
        to,
        subject,
        text,
        html: html || `<p>${text.replace(/\n/g, '<br>')}</p>`
      };

      const response = await this.mailgunClient.messages.create(this.domain, data);
      console.log('✅ Email sent via Mailgun:', response.id);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email via Mailgun:', error);
      return false;
    }
  }

  isConfigured(): boolean {
    return this.mailgunClient !== null && this.domain !== '';
  }
}
