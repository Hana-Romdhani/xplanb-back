/**
 * Realtime Module
 *
 * Module pour la co-édition temps-réel des documents
 *
 * Emplacement: src/realtime/realtime.module.ts
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { Documents, DocumentsSchema } from '../document/document.schema';
import { DocumentVersion, DocumentVersionSchema } from '../document/document-version.schema';
import { User, UserSchema } from '../users/users.schema';
import { Content, ContentSchema } from '../content/content.schema';
import { Notification, NotificationSchema } from '../notifications/notifications.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Documents.name, schema: DocumentsSchema },
      { name: DocumentVersion.name, schema: DocumentVersionSchema },
      { name: User.name, schema: UserSchema },
      { name: Content.name, schema: ContentSchema },
      { name: Notification.name, schema: NotificationSchema }
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('SECRET_KEY'),
        signOptions: { expiresIn: '1d' }
      })
    })
  ],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService]
})
export class RealtimeModule {}
