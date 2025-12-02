import { IsOptional, IsString, IsDateString } from 'class-validator';

export class AnalyticsMetricsDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;
}

export class ProductivityMetricsDto {
  hoursEdited: number;
  documentsEdited: number;
  pomodoroSessions: number;
  averageSessionLength: number;
  lastActiveDate: Date;
}

export class TeamCollaborationDto {
  activeEditors: number;
  totalComments: number;
  totalCoEdits: number;
  averageSessionDuration: number;
  mostActiveUsers: Array<{
    userId: string;
    userName: string;
    hoursActive: number;
  }>;
}

export class ProjectOverviewDto {
  folderId: string;
  folderName: string;
  totalDocuments: number;
  completedDocuments: number;
  completionPercentage: number;
  lastActivity: Date;
  activeUsers: number;
}

export class CalendarLinksDto {
  eventId: string;
  eventTitle: string;
  startTime: Date;
  endTime: Date;
  linkedDocId?: string;
  linkedDocTitle?: string;
  linkedFolderId?: string;
  linkedFolderName?: string;
}
