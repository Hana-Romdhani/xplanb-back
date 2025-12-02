import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivityLog, ActivityLogDocument } from './activity-logs.schema';
import { Documents, DocumentsDocument } from '../document/document.schema';
import { Folder, FolderDocument } from '../folder/folder.schema';

export interface LogActivityDto {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
}

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectModel(ActivityLog.name)
    private activityLogModel: Model<ActivityLogDocument>,
    @InjectModel(Documents.name)
    private documentsModel: Model<DocumentsDocument>,
    @InjectModel(Folder.name)
    private folderModel: Model<FolderDocument>
  ) {}

  async logActivity(logActivityDto: LogActivityDto): Promise<ActivityLog> {
    const activityLog = new this.activityLogModel(logActivityDto);
    return activityLog.save();
  }

  async getUserActivityLogs(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ActivityLog[]> {
    return this.activityLogModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .exec();
  }

  async getAllActivityLogs(limit: number = 100, offset: number = 0): Promise<ActivityLog[]> {
    return this.activityLogModel
      .find()
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .exec();
  }

  async getActivityStats(userId?: string): Promise<any> {
    const matchQuery = userId ? { userId } : {};

    const stats = await this.activityLogModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalActivities = await this.activityLogModel.countDocuments(matchQuery);

    return {
      totalActivities,
      byAction: stats
    };
  }

  async getRecentActivity(userId?: string, hours: number = 24): Promise<any[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const query = userId ? { userId, createdAt: { $gte: since } } : { createdAt: { $gte: since } };

    const activities = await this.activityLogModel
      .find(query)
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();

    // Enrich activities with resource titles
    const enrichedActivities = await Promise.all(
      activities.map(async (activity) => {
        const enrichedActivity = activity.toObject();

        // Try to get resource title if we have resourceId and resourceType
        if (activity.resourceId && activity.resourceType) {
          try {
            if (activity.resourceType === 'document') {
              const document = await this.documentsModel.findById(activity.resourceId);
              if (document) {
                enrichedActivity.resourceTitle = document.Title;
                // Also try to get folder name if document has folderId
                if (document.folderId) {
                  const folder = await this.folderModel.findById(document.folderId);
                  if (folder) {
                    enrichedActivity.resourceFolder = folder.Name;
                  }
                }
              }
            } else if (activity.resourceType === 'folder') {
              const folder = await this.folderModel.findById(activity.resourceId);
              if (folder) {
                enrichedActivity.resourceTitle = folder.Name;
              }
            }
          } catch (error) {
            console.error('Error fetching resource title:', error);
          }
        }

        // If details is a JSON string, parse it
        if (activity.details && typeof activity.details === 'string') {
          try {
            const parsedDetails = JSON.parse(activity.details);
            if (parsedDetails.title) {
              enrichedActivity.resourceTitle = parsedDetails.title;
            } else if (parsedDetails.name) {
              enrichedActivity.resourceTitle = parsedDetails.name;
            }
          } catch (e) {
            // Not JSON, keep as is
          }
        }

        return enrichedActivity;
      })
    );

    return enrichedActivities;
  }
}
