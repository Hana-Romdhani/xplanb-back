import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { FolderModule } from './folder/folder.module';
import { DocumentModule } from './document/document.module';
import { ContentModule } from './content/content.module';
import { MailingModule } from './mailing/mailing.module';
import { OpenAiModule } from './open-ai/open-ai.module';
import { CommentsModule } from './comments/comments.module';
import { RealtimeModule } from './realtime/realtime.module';
import { YjsModule } from './yjs/yjs.module';
import { VersioningModule } from './versioning/versioning.module';
import { SharesModule } from './shares/shares.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MeetingsModule } from './meetings/meetings.module';
import { ChartsModule } from './charts/charts.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { PomodoroModule } from './pomodoro/pomodoro.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { ActivityLoggingMiddleware } from './activity-logs/activity-logging.middleware';
import { CalendarModule } from './calendar/calendar.module';
import { FileUploadModule } from './file-upload/file-upload.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ChatModule } from './chat/chat.module';
import { AdminAutoCreateService } from './admin/admin-auto-create.service';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true }),
    UsersModule,
    MongooseModule.forRoot(process.env.DATABASE_URL),
    AuthModule,
    FolderModule,
    DocumentModule,
    ContentModule,
    MailingModule,
    OpenAiModule,
    CommentsModule,
    RealtimeModule,
    YjsModule,
    VersioningModule,
    SharesModule,
    AnalyticsModule,
    MeetingsModule,
    ChartsModule,
    ComplaintsModule,
    PomodoroModule,
    ActivityLogsModule,
    CalendarModule,
    FileUploadModule,
    NotificationsModule,
    ChatModule
  ],
  controllers: [AppController],
  providers: [AppService, AdminAutoCreateService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ActivityLoggingMiddleware).forRoutes('*'); // Apply to all routes
  }
}
