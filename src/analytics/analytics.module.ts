import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { BusinessAnalyticsService } from './business-analytics.service';
import { Documents, DocumentsSchema } from '../document/document.schema';
import { Folder, FolderSchema } from '../folder/folder.schema';
import { User, UserSchema } from '../users/users.schema';
import { Content, ContentSchema } from '../content/content.schema';
import { Comment, CommentSchema } from '../comments/comments.schema';
import { DocumentVersion, DocumentVersionSchema } from '../document/document-version.schema';
import { Meeting, MeetingSchema } from '../meetings/schemas/meeting.schema';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Documents.name, schema: DocumentsSchema },
      { name: Folder.name, schema: FolderSchema },
      { name: User.name, schema: UserSchema },
      { name: Content.name, schema: ContentSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: DocumentVersion.name, schema: DocumentVersionSchema },
      { name: Meeting.name, schema: MeetingSchema }
    ]),
    RealtimeModule
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, BusinessAnalyticsService],
  exports: [AnalyticsService, BusinessAnalyticsService]
})
export class AnalyticsModule {}
