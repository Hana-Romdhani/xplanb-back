import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { CommentsRepository } from './comments.repository';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentSchema, Comment } from './comments.schema';
import { DocumentModule } from '../document/document.module';
import { CommentsGateway } from './comments.Gateway';
import { Notification, NotificationSchema } from '../notifications/notifications.schema';
import { User, UserSchema } from '../users/users.schema';

@Module({
  providers: [CommentsService, CommentsRepository, CommentsGateway],
  controllers: [CommentsController],
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema }
    ]),
    DocumentModule
  ]
})
export class CommentsModule {}
