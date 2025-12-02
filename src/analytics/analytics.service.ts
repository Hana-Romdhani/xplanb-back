import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Documents } from '../document/document.schema';
import { Folder } from '../folder/folder.schema';
import { User } from '../users/users.schema';
import { Content } from '../content/content.schema';
import { Comment } from '../comments/comments.schema';
import { DocumentVersion } from '../document/document-version.schema';
import { RealtimeService } from '../realtime/realtime.service';
import {
  ProductivityMetricsDto,
  TeamCollaborationDto,
  ProjectOverviewDto,
  CalendarLinksDto
} from './dto/analytics-metrics.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Documents.name) private documentsModel: Model<Documents>,
    @InjectModel(Folder.name) private folderModel: Model<Folder>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Content.name) private contentModel: Model<Content>,
    @InjectModel(Comment.name) private commentsModel: Model<Comment>,
    @InjectModel(DocumentVersion.name) private documentVersionModel: Model<DocumentVersion>,
    @Optional() private readonly realtimeService?: RealtimeService
  ) {}

  async getUserProductivityMetrics(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ProductivityMetricsDto> {
    const query: any = { lastEditedBy: userId };

    if (startDate && endDate) {
      query.updatedDate = {
        $gte: startDate,
        $lte: endDate
      };
    }

    const documents = await this.documentsModel.find(query).exec();

    // Calculate hours edited based on document update frequency
    const hoursEdited = documents.reduce((total, doc) => {
      const editDuration = this.calculateEditDuration(doc);
      return total + editDuration;
    }, 0);

    // For now, simulate pomodoro sessions (will be replaced when PomodoroSession model is added)
    const pomodoroSessions = Math.floor(hoursEdited * 2); // Assume 2 sessions per hour

    const lastActiveDate =
      documents.length > 0
        ? new Date(Math.max(...documents.map((doc) => new Date(doc.updatedDate).getTime())))
        : new Date();

    return {
      hoursEdited: Math.round(hoursEdited * 100) / 100,
      documentsEdited: documents.length,
      pomodoroSessions,
      averageSessionLength: pomodoroSessions > 0 ? hoursEdited / pomodoroSessions : 0,
      lastActiveDate
    };
  }

  async getTeamCollaborationMetrics(
    organizationId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TeamCollaborationDto> {
    const query: any = {};

    if (startDate && endDate) {
      query.updatedDate = {
        $gte: startDate,
        $lte: endDate
      };
    }

    // Get all documents with collaboration data
    const documents = await this.documentsModel.find(query).exec();

    // Get comments
    const comments = await this.commentsModel.find(query).exec();

    // Get real-time connected users count (preferred) or fallback to historical editors
    let activeEditors: number;
    try {
      if (this.realtimeService) {
        activeEditors = this.realtimeService.getTotalConnectedUsersCount();
      } else {
        // Fallback to historical data if realtime service is not available
        const activeEditorIds = new Set(documents.map((doc) => doc.lastEditedBy));
        activeEditors = activeEditorIds.size;
      }
    } catch (error) {
      // Fallback to historical data on error
      const activeEditorIds = new Set(documents.map((doc) => doc.lastEditedBy));
      activeEditors = activeEditorIds.size;
    }

    // Get user details for most active users
    const userActivityMap = new Map();
    documents.forEach((doc) => {
      const userId = doc.lastEditedBy;
      const duration = this.calculateEditDuration(doc);

      if (userActivityMap.has(userId)) {
        userActivityMap.set(userId, userActivityMap.get(userId) + duration);
      } else {
        userActivityMap.set(userId, duration);
      }
    });

    const mostActiveUsers = await Promise.all(
      Array.from(userActivityMap.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(async ([userId, hoursActive]) => {
          const user = await this.userModel.findById(userId).exec();
          return {
            userId,
            userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
            hoursActive: Math.round(hoursActive * 100) / 100
          };
        })
    );

    return {
      activeEditors,
      totalComments: comments.length,
      totalCoEdits: documents.filter((doc) => doc.sharedWith && doc.sharedWith.length > 0).length,
      averageSessionDuration:
        documents.length > 0
          ? documents.reduce((sum, doc) => sum + this.calculateEditDuration(doc), 0) /
            documents.length
          : 0,
      mostActiveUsers
    };
  }

  async getProjectOverview(folderId?: string, userId?: string): Promise<ProjectOverviewDto[]> {
    const query: any = {};
    if (folderId) {
      query._id = folderId;
    }

    // Filter by user if provided
    if (userId) {
      query.$or = [{ user: userId }, { sharedWith: userId }];
    }

    const folders = await this.folderModel
      .find(query)
      .populate('user', '_id firstName lastName email')
      .exec();

    const projectOverviews = await Promise.all(
      folders.map(async (folder) => {
        const documents = await this.documentsModel.find({ folderId: folder._id }).exec();
        const completedDocuments = documents.filter((doc) => doc.archived === false).length;
        const completionPercentage =
          documents.length > 0 ? (completedDocuments / documents.length) * 100 : 0;

        const lastActivity =
          documents.length > 0
            ? new Date(Math.max(...documents.map((doc) => new Date(doc.updatedDate).getTime())))
            : folder.createdDate;

        // Count unique active users
        const activeUsers = new Set(
          documents.map((doc) => doc.lastEditedBy?.toString()).filter(Boolean)
        ).size;

        // Get shared users count
        const sharedWithCount = folder.sharedWith?.length || 0;

        return {
          folderId: folder._id.toString(),
          folderName: folder.Name,
          totalDocuments: documents.length,
          completedDocuments,
          completionPercentage: Math.round(completionPercentage * 100) / 100,
          lastActivity,
          activeUsers,
          sharedUsers: sharedWithCount,
          owner: folder.user
            ? {
                _id: folder.user._id.toString(),
                name: `${folder.user.firstName} ${folder.user.lastName}`
              }
            : null
        };
      })
    );

    // Sort by total documents descending
    return projectOverviews.sort((a, b) => b.totalDocuments - a.totalDocuments);
  }

  async getFolderAnalytics(userId?: string) {
    const query: any = {};

    // If userId provided, get folders user owns or has access to
    if (userId) {
      query.$or = [{ user: userId }, { sharedWith: userId }];
    }

    const folders = await this.folderModel.find(query).exec();

    // Get all documents grouped by folder
    const folderStats = await Promise.all(
      folders.map(async (folder) => {
        const documents = await this.documentsModel.find({ folderId: folder._id }).exec();
        const recentDocuments = documents.filter((doc) => {
          const docDate = new Date(doc.updatedDate);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return docDate >= weekAgo;
        });

        const comments = await this.commentsModel
          .find({
            documentId: { $in: documents.map((doc) => doc._id) }
          })
          .exec();

        return {
          folderId: folder._id.toString(),
          folderName: folder.Name,
          totalDocuments: documents.length,
          recentDocuments: recentDocuments.length,
          totalComments: comments.length,
          activeCollaborators: new Set(
            documents.map((doc) => doc.lastEditedBy?.toString()).filter(Boolean)
          ).size,
          sharedWith: folder.sharedWith?.length || 0
        };
      })
    );

    const totalFolders = folders.length;
    const totalDocuments = folderStats.reduce((sum, stat) => sum + stat.totalDocuments, 0);
    const totalSharedFolders = folders.filter(
      (f) => f.sharedWith && f.sharedWith.length > 0
    ).length;
    const mostActiveFolders = folderStats
      .sort((a, b) => b.recentDocuments - a.recentDocuments)
      .slice(0, 5);

    return {
      totalFolders,
      totalDocuments,
      totalSharedFolders,
      averageDocumentsPerFolder:
        totalFolders > 0 ? Math.round((totalDocuments / totalFolders) * 100) / 100 : 0,
      folderStats: folderStats.sort((a, b) => b.totalDocuments - a.totalDocuments),
      mostActiveFolders
    };
  }

  async getCalendarLinks(startDate: Date, endDate: Date): Promise<CalendarLinksDto[]> {
    // For now, return mock data since calendar integration needs to be implemented
    // This would typically query a calendar events collection
    return [
      {
        eventId: '1',
        eventTitle: 'Project Review Meeting',
        startTime: new Date(startDate.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
        endTime: new Date(startDate.getTime() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // Tomorrow + 1 hour
        linkedDocId: 'doc1',
        linkedDocTitle: 'Project Specifications',
        linkedFolderId: 'folder1',
        linkedFolderName: 'Design Documents'
      },
      {
        eventId: '2',
        eventTitle: 'Team Standup',
        startTime: new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
        endTime: new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // Day after tomorrow + 30 min
        linkedFolderId: 'folder2',
        linkedFolderName: 'Sprint Planning'
      }
    ];
  }

  async getVersionAnalytics(startDate?: Date, endDate?: Date, userId?: string) {
    const query: any = {};

    if (startDate && endDate) {
      query.createdAt = {
        $gte: startDate,
        $lte: endDate
      };
    }

    // Filter by user if provided
    if (userId) {
      query.createdBy = userId;
    }

    // Get all document versions
    const versions = await this.documentVersionModel
      .find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('documentId', 'Title')
      .sort({ createdAt: -1 })
      .exec();

    // Calculate today's metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const versionsCreatedToday = versions.filter(
      (version) => new Date(version.createdAt) >= today
    ).length;

    // Calculate this week's metrics
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const versionsCreatedThisWeek = versions.filter(
      (version) => new Date(version.createdAt) >= weekAgo
    ).length;

    // Get most active editors based on version creation and comments
    const editorActivityMap = new Map();

    // Process versions
    versions.forEach((version) => {
      const userId = version.createdBy._id.toString();
      // Handle populated user data safely
      const user = version.createdBy as any;
      const userName =
        user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Unknown User';

      if (editorActivityMap.has(userId)) {
        const current = editorActivityMap.get(userId);
        editorActivityMap.set(userId, {
          userId,
          userName,
          versionsCreated: current.versionsCreated + 1,
          commentsAdded: current.commentsAdded || 0
        });
      } else {
        editorActivityMap.set(userId, {
          userId,
          userName,
          versionsCreated: 1,
          commentsAdded: 0
        });
      }
    });

    // Process comments - filter by user if provided
    const commentQuery: any = {};
    if (userId) {
      commentQuery.user = userId;
    }
    const comments = await this.commentsModel
      .find(commentQuery)
      .populate('user', 'firstName lastName')
      .exec();
    comments.forEach((comment) => {
      const userId = comment.user._id.toString();
      const user = comment.user as any;
      const userName =
        user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Unknown User';

      if (editorActivityMap.has(userId)) {
        const current = editorActivityMap.get(userId);
        editorActivityMap.set(userId, {
          userId,
          userName,
          versionsCreated: current.versionsCreated || 0,
          commentsAdded: (current.commentsAdded || 0) + 1
        });
      } else {
        editorActivityMap.set(userId, {
          userId,
          userName,
          versionsCreated: 0,
          commentsAdded: 1
        });
      }
    });

    const mostActiveEditors = Array.from(editorActivityMap.values())
      .sort((a, b) => b.versionsCreated - a.versionsCreated)
      .slice(0, 5);

    // Generate version trends for the last 7 days with comments
    const versionTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const versionsOnDate = versions.filter((version) => {
        const versionDate = new Date(version.createdAt);
        return versionDate >= date && versionDate < nextDate;
      }).length;

      const commentsOnDate = comments.filter((comment) => {
        const commentDate = new Date(comment.createdAt);
        return commentDate >= date && commentDate < nextDate;
      }).length;

      versionTrends.push({
        date: date.toISOString().split('T')[0],
        versions: versionsOnDate,
        comments: commentsOnDate
      });
    }

    return {
      totalVersions: versions.length,
      versionsCreatedToday,
      versionsCreatedThisWeek,
      mostActiveEditors,
      versionTrends,
      recentVersions: versions.slice(0, 10), // Last 10 versions for detailed view
      totalComments: comments.length,
      commentsCreatedToday: comments.filter((comment) => new Date(comment.createdAt) >= today)
        .length
    };
  }

  private calculateEditDuration(document: Documents): number {
    // Simple calculation based on document size and update frequency
    // In a real implementation, this would track actual editing sessions
    // Content is now stored in Content collection, not Document collection
    const baseTime = 0.5; // Default 30 minutes per document
    return Math.min(baseTime, 2); // Cap at 2 hours per document
  }
}
