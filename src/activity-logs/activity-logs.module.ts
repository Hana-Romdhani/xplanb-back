import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityLog, ActivityLogSchema } from './activity-logs.schema';
import { ActivityLoggingMiddleware } from './activity-logging.middleware';
import { Documents, DocumentsSchema } from '../document/document.schema';
import { Folder, FolderSchema } from '../folder/folder.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityLog.name, schema: ActivityLogSchema },
      { name: Documents.name, schema: DocumentsSchema },
      { name: Folder.name, schema: FolderSchema }
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('SECRET_KEY'),
        signOptions: { expiresIn: '1d' }
      }),
      inject: [ConfigService]
    })
  ],
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService, ActivityLoggingMiddleware],
  exports: [ActivityLogsService, ActivityLoggingMiddleware, JwtModule]
})
export class ActivityLogsModule {}
