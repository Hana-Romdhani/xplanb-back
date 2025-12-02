import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { MailgunService } from './mailgun.service';

@Module({
  imports: [ConfigModule],
  providers: [EmailService, MailgunService],
  controllers: [EmailController],
  exports: [EmailService, MailgunService]
})
export class EmailModule {}
