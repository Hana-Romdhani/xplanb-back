import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChartComment } from './chart-comment.schema';
import { ChartVersion } from './chart-version.schema';
import { ChartMetadata } from './chart-metadata.schema';
import { Types } from 'mongoose';

@Injectable()
export class ChartsService {
  constructor(
    @InjectModel(ChartComment.name) private chartCommentModel: Model<ChartComment>,
    @InjectModel(ChartVersion.name) private chartVersionModel: Model<ChartVersion>,
    @InjectModel(ChartMetadata.name) private chartMetadataModel: Model<ChartMetadata>
  ) {}

  // Chart Comments
  async createComment(comment: Partial<ChartComment>): Promise<ChartComment> {
    const newComment = new this.chartCommentModel({
      ...comment,
      user: new Types.ObjectId(comment.user as any)
    });
    return newComment.save();
  }

  async getCommentsByChartId(chartId: string): Promise<ChartComment[]> {
    return this.chartCommentModel.find({ chartId }).populate('user').sort({ createdAt: -1 }).exec();
  }

  async updateComment(commentId: string, content: string): Promise<ChartComment> {
    return this.chartCommentModel
      .findByIdAndUpdate(commentId, { content }, { new: true })
      .populate('user')
      .exec();
  }

  async deleteComment(commentId: string): Promise<ChartComment> {
    return this.chartCommentModel.findByIdAndDelete(commentId).exec();
  }

  // Chart Versions
  async createVersion(version: Partial<ChartVersion>): Promise<ChartVersion> {
    // Deactivate all previous versions for this chart
    await this.chartVersionModel.updateMany({ chartId: version.chartId }, { isActive: false });

    const newVersion = new this.chartVersionModel({
      ...version,
      createdBy: new Types.ObjectId(version.createdBy as any),
      isActive: true
    });
    return newVersion.save();
  }

  async getVersionsByChartId(chartId: string): Promise<ChartVersion[]> {
    return this.chartVersionModel
      .find({ chartId })
      .populate('createdBy')
      .sort({ version: -1 })
      .exec();
  }

  async restoreVersion(versionId: string): Promise<ChartVersion> {
    const version = await this.chartVersionModel.findById(versionId).exec();
    if (!version) {
      throw new Error('Version not found');
    }

    // Deactivate all versions for this chart
    await this.chartVersionModel.updateMany({ chartId: version.chartId }, { isActive: false });

    // Activate the selected version
    return this.chartVersionModel
      .findByIdAndUpdate(versionId, { isActive: true }, { new: true })
      .populate('createdBy')
      .exec();
  }

  async getActiveVersion(chartId: string): Promise<ChartVersion> {
    return this.chartVersionModel.findOne({ chartId, isActive: true }).populate('createdBy').exec();
  }

  // Chart Metadata
  async createChartMetadata(metadata: Partial<ChartMetadata>): Promise<ChartMetadata> {
    const newMetadata = new this.chartMetadataModel({
      ...metadata,
      createdBy: new Types.ObjectId(metadata.createdBy as any)
    });
    return newMetadata.save();
  }

  async getChartMetadata(chartId: string): Promise<ChartMetadata> {
    return this.chartMetadataModel.findById(chartId).populate('createdBy').exec();
  }

  async updateChartMetadata(
    chartId: string,
    metadata: Partial<ChartMetadata>
  ): Promise<ChartMetadata> {
    return this.chartMetadataModel
      .findByIdAndUpdate(chartId, { ...metadata, updatedAt: new Date() }, { new: true })
      .populate('createdBy')
      .exec();
  }

  async getUserCharts(userId: string): Promise<ChartMetadata[]> {
    return this.chartMetadataModel
      .find({
        $or: [{ createdBy: userId }, { sharedWithUsers: userId }]
      })
      .populate('createdBy')
      .sort({ updatedAt: -1 })
      .exec();
  }

  async shareChart(
    chartId: string,
    shareOptions: { isPublic: boolean; shareWithUsers?: string[] }
  ): Promise<ChartMetadata> {
    return this.chartMetadataModel
      .findByIdAndUpdate(
        chartId,
        {
          isPublic: shareOptions.isPublic,
          sharedWithUsers: shareOptions.shareWithUsers || [],
          updatedAt: new Date()
        },
        { new: true }
      )
      .populate('createdBy')
      .exec();
  }

  // Chart Analytics
  async trackChartInteraction(
    chartId: string,
    interaction: {
      type: string;
      data?: any;
      userId?: string;
    }
  ): Promise<void> {
    // This would typically be stored in a separate analytics collection
    // For now, we'll just log it
    console.log(`Chart interaction tracked: ${interaction.type} on chart ${chartId}`, interaction);
  }

  async getChartAnalytics(chartId: string, dateRange?: { start: Date; end: Date }): Promise<any> {
    // Mock analytics data - replace with actual analytics implementation
    return {
      chartId,
      totalViews: Math.floor(Math.random() * 1000) + 100,
      totalComments: await this.chartCommentModel.countDocuments({ chartId }),
      totalVersions: await this.chartVersionModel.countDocuments({ chartId }),
      lastViewed: new Date(),
      interactions: {
        views: Math.floor(Math.random() * 500) + 50,
        downloads: Math.floor(Math.random() * 50) + 5,
        shares: Math.floor(Math.random() * 20) + 2
      }
    };
  }

  // Export functionality
  async exportChart(chartId: string, format: 'png' | 'pdf' | 'json'): Promise<any> {
    const metadata = await this.getChartMetadata(chartId);
    const activeVersion = await this.getActiveVersion(chartId);
    const comments = await this.getCommentsByChartId(chartId);

    switch (format) {
      case 'json':
        return {
          metadata,
          version: activeVersion,
          comments,
          exportedAt: new Date()
        };
      case 'png':
      case 'pdf':
        // These would require chart rendering libraries
        throw new Error(`${format} export not yet implemented`);
      default:
        throw new Error('Unsupported export format');
    }
  }
}
