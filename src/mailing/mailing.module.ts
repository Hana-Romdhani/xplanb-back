import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailingController } from './mailing.controller';
import { MailingService } from './mailing.service';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';

@Module({
  controllers: [MailingController],
  providers: [MailingService],
  imports: [UsersModule, ConfigModule, EmailModule],
  exports: [MailingService]
})
export class MailingModule {}
