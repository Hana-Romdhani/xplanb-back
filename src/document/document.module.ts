import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Documents, DocumentsSchema } from './document.schema';
import { DocumentService } from './document.service';
import { DocumentsRepository } from './document.repository';
import { DocumentController } from './document.controller';
import { Folder, FolderSchema } from 'src/folder/folder.schema';
import { Content, ContentSchema } from 'src/content/content.schema';
import { FolderRepository } from 'src/folder/folder.repository';
import { ContentRepository } from 'src/content/content.repository';
import { FolderModule } from 'src/folder/folder.module';
import { Notification, NotificationSchema } from 'src/notifications/notifications.schema';
import { User, UserSchema } from 'src/users/users.schema';

@Module({
  controllers: [DocumentController],
  exports: [MongooseModule, DocumentsRepository, DocumentService],

  providers: [DocumentService, DocumentsRepository, FolderRepository, ContentRepository],
  imports: [
    MongooseModule.forFeature([
      { name: Documents.name, schema: DocumentsSchema },
      { name: Folder.name, schema: FolderSchema },
      { name: Content.name, schema: ContentSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema }
    ]),
    FolderModule
  ]
})
export class DocumentModule {}
