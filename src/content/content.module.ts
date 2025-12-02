import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { ContentRepository } from './content.repository';
import { MongooseModule } from '@nestjs/mongoose';
import { Content, ContentSchema } from './content.schema';
import { DocumentModule } from '../document/document.module';
import { DocumentsRepository } from '../document/document.repository';
import { Notification, NotificationSchema } from '../notifications/notifications.schema';
import { User, UserSchema } from '../users/users.schema';

@Module({
  providers: [ContentService, ContentRepository, DocumentsRepository],
  controllers: [ContentController],
  exports: [ContentService, MongooseModule],
  imports: [
    MongooseModule.forFeature([
      { name: Content.name, schema: ContentSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema }
    ]),
    DocumentModule
  ]
})
export class ContentModule {}
