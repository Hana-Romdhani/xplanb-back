import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Documents } from '../document/document.schema';
import { Folder } from '../folder/folder.schema';
import { User } from '../users/users.schema';
import { Content } from '../content/content.schema';
import { Comment } from '../comments/comments.schema';
import { DocumentVersion } from '../document/document-version.schema';
import { Meeting, MeetingSchema } from '../meetings/schemas/meeting.schema';

export interface ProductivityScore {
  userId: string;
  userName: string;
  score: number; // 0-100
  metrics: {
    documentsCreated: number;
    versionsCreated: number;
    commentsAdded: number;
    meetingsAttended: number;
    collaborationScore: number;
  };
  insights: string[];
}

export interface CollaborationHealth {
  overallScore: number; // 0-100
  teamCollaboration: {
    crossTeamWork: number;
    sharedDocuments: number;
    activeCollaborations: number;
  };
  bottlenecks: Array<{
    type: 'silo' | 'inactive' | 'overloaded';
    description: string;
    users: string[];
  }>;
  recommendations: string[];
}

export interface SmartRecommendation {
  type: 'productivity' | 'collaboration' | 'efficiency' | 'engagement';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  impact: string;
  users: string[];
}

export interface ROIMetrics {
  timeSaved: number; // hours
  efficiencyGain: number; // percentage
  collaborationIncrease: number; // percentage
  documentCompletionRate: number; // percentage
  costSavings: number; // estimated
  beforeAfterComparison: {
    before: {
      avgDocumentTime: number;
      collaborationRate: number;
      completionRate: number;
    };
    after: {
      avgDocumentTime: number;
      collaborationRate: number;
      completionRate: number;
    };
  };
}

export interface DocumentLifecycle {
  stage: 'creation' | 'collaboration' | 'review' | 'completion' | 'archived';
  count: number;
  avgTimeInStage: number; // hours
  bottlenecks: Array<{
    stage: string;
    avgTime: number;
    description: string;
  }>;
}

@Injectable()
export class BusinessAnalyticsService {
  constructor(
    @InjectModel(Documents.name) private documentsModel: Model<Documents>,
    @InjectModel(Folder.name) private folderModel: Model<Folder>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Content.name) private contentModel: Model<Content>,
    @InjectModel(Comment.name) private commentsModel: Model<Comment>,
    @InjectModel(DocumentVersion.name) private documentVersionModel: Model<DocumentVersion>,
    @InjectModel(Meeting.name) private meetingModel: Model<Meeting>
  ) {}

  async getProductivityScores(): Promise<ProductivityScore[]> {
    const users = await this.userModel.find().exec();
    const productivityScores: ProductivityScore[] = [];

    for (const user of users) {
      // Get user's activity data
      const documentsCreated = await this.documentsModel.countDocuments({
        createdBy: user._id,
        createdDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });

      const versionsCreated = await this.documentVersionModel.countDocuments({
        createdBy: user._id,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      const commentsAdded = await this.commentsModel.countDocuments({
        user: user._id,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      const meetingsAttended = await this.meetingModel.countDocuments({
        participants: user._id,
        startTime: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      // Calculate collaboration score
      const sharedDocuments = await this.documentsModel.countDocuments({
        sharedWith: user._id
      });

      const collaborationScore = Math.min(sharedDocuments * 10, 100);

      // Calculate overall productivity score (0-100)
      const score = Math.min(
        documentsCreated * 15 +
          versionsCreated * 5 +
          commentsAdded * 3 +
          meetingsAttended * 10 +
          collaborationScore * 0.3,
        100
      );

      // Generate insights
      const insights: string[] = [];
      if (score > 80) insights.push('High performer - excellent productivity');
      else if (score > 60) insights.push('Good productivity level');
      else if (score > 40) insights.push('Moderate productivity - room for improvement');
      else insights.push('Low productivity - needs attention');

      if (versionsCreated > 20) insights.push('Very active editor');
      if (commentsAdded > 10) insights.push('Good collaborator');
      if (meetingsAttended > 5) insights.push('Team player');

      productivityScores.push({
        userId: user._id.toString(),
        userName: `${user.firstName} ${user.lastName}`,
        score: Math.round(score),
        metrics: {
          documentsCreated,
          versionsCreated,
          commentsAdded,
          meetingsAttended,
          collaborationScore: Math.round(collaborationScore)
        },
        insights
      });
    }

    return productivityScores.sort((a, b) => b.score - a.score);
  }

  async getCollaborationHealth(): Promise<CollaborationHealth> {
    const totalDocuments = await this.documentsModel.countDocuments();
    const sharedDocuments = await this.documentsModel.countDocuments({
      sharedWith: { $exists: true, $ne: [] }
    });

    const totalUsers = await this.userModel.countDocuments();
    const activeUsers = await this.userModel.countDocuments({
      lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    // Calculate cross-team work
    const crossTeamWork = await this.documentsModel.aggregate([
      { $match: { sharedWith: { $exists: true, $ne: [] } } },
      { $group: { _id: null, avgCollaborators: { $avg: { $size: '$sharedWith' } } } }
    ]);

    const avgCollaborators = crossTeamWork[0]?.avgCollaborators || 0;

    // Calculate collaboration score
    const collaborationRate = totalDocuments > 0 ? (sharedDocuments / totalDocuments) * 100 : 0;
    const userEngagementRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;
    const overallScore = Math.round(
      (collaborationRate + userEngagementRate + avgCollaborators * 10) / 3
    );

    // Identify bottlenecks
    const bottlenecks: Array<{
      type: 'silo' | 'inactive' | 'overloaded';
      description: string;
      users: string[];
    }> = [];

    // Find inactive users
    const inactiveUsers = await this.userModel
      .find({
        lastLogin: { $lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
      })
      .exec();

    if (inactiveUsers.length > 0) {
      bottlenecks.push({
        type: 'inactive',
        description: `${inactiveUsers.length} users haven't logged in for 2+ weeks`,
        users: inactiveUsers.map((u) => `${u.firstName} ${u.lastName}`)
      });
    }

    // Find users with no shared documents (silos) - improved logic including shared folders
    const allUsers = await this.userModel.find().exec();
    const siloUsers = [];

    for (const user of allUsers) {
      // Check if user has any documents they created OR are shared with
      const userDocs = await this.documentsModel
        .find({
          $or: [{ createdBy: user._id }, { sharedWith: user._id }]
        })
        .exec();

      // Also check if user has access to any shared folders
      const sharedFolders = await this.folderModel
        .find({
          $or: [{ createdBy: user._id }, { sharedWith: user._id }]
        })
        .exec();

      // User is only in a silo if they have NO documents AND NO shared folders
      if (userDocs.length === 0 && sharedFolders.length === 0) {
        siloUsers.push(user);
      }
    }

    if (siloUsers.length > 0) {
      bottlenecks.push({
        type: 'silo',
        description: `${siloUsers.length} users work in isolation`,
        users: siloUsers.map((u) => `${u.firstName} ${u.lastName}`)
      });
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (collaborationRate < 50) {
      recommendations.push('Encourage more document sharing to improve collaboration');
    }
    if (userEngagementRate < 80) {
      recommendations.push('Send engagement reminders to inactive users');
    }
    if (avgCollaborators < 2) {
      recommendations.push('Promote cross-team collaboration on projects');
    }

    return {
      overallScore,
      teamCollaboration: {
        crossTeamWork: Math.round(avgCollaborators * 10),
        sharedDocuments: Math.round(collaborationRate),
        activeCollaborations: sharedDocuments
      },
      bottlenecks,
      recommendations
    };
  }

  async getSmartRecommendations(): Promise<SmartRecommendation[]> {
    const recommendations: SmartRecommendation[] = [];

    // Get productivity scores
    const productivityScores = await this.getProductivityScores();
    const lowPerformers = productivityScores.filter((p) => p.score < 40);
    const highPerformers = productivityScores.filter((p) => p.score > 80);

    // Productivity recommendations
    if (lowPerformers.length > 0) {
      recommendations.push({
        type: 'productivity',
        priority: 'high',
        title: 'Boost Team Productivity',
        description: `${lowPerformers.length} team members have low productivity scores`,
        action: 'Schedule 1-on-1 meetings to identify blockers and provide support',
        impact: 'Expected 25% productivity increase',
        users: lowPerformers.map((p) => p.userName)
      });
    }

    // Collaboration recommendations
    const collaborationHealth = await this.getCollaborationHealth();
    if (collaborationHealth.bottlenecks.length > 0) {
      const siloBottleneck = collaborationHealth.bottlenecks.find((b) => b.type === 'silo');
      if (siloBottleneck) {
        recommendations.push({
          type: 'collaboration',
          priority: 'medium',
          title: 'Break Down Team Silos',
          description: `${siloBottleneck.users.length} users work in isolation`,
          action: 'Assign collaborative projects and encourage knowledge sharing',
          impact: 'Improved team cohesion and knowledge transfer',
          users: siloBottleneck.users
        });
      }
    }

    // Efficiency recommendations
    const documents = await this.documentsModel.find().exec();
    const versions = await this.documentVersionModel.find().exec();
    const avgVersionsPerDoc = documents.length > 0 ? versions.length / documents.length : 0;

    if (avgVersionsPerDoc > 10) {
      recommendations.push({
        type: 'efficiency',
        priority: 'medium',
        title: 'Optimize Document Workflow',
        description: 'Documents average 10+ versions, indicating inefficient editing',
        action: 'Implement review processes and clear editing guidelines',
        impact: 'Reduced editing time by 30%',
        users: ['All Editors']
      });
    }

    // Engagement recommendations
    const inactiveUsers = await this.userModel
      .find({
        lastLogin: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
      .exec();

    if (inactiveUsers.length > 0) {
      recommendations.push({
        type: 'engagement',
        priority: 'high',
        title: 'Re-engage Inactive Users',
        description: `${inactiveUsers.length} users haven't been active this week`,
        action: 'Send personalized check-ins and highlight recent team activity',
        impact: 'Increased user engagement and retention',
        users: inactiveUsers.map((u) => `${u.firstName} ${u.lastName}`)
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  async getROIMetrics(): Promise<ROIMetrics> {
    const documents = await this.documentsModel.find().exec();
    const versions = await this.documentVersionModel.find().exec();
    const comments = await this.commentsModel.find().exec();

    // Calculate current metrics
    const avgVersionsPerDoc = documents.length > 0 ? versions.length / documents.length : 0;
    const avgCommentsPerDoc = documents.length > 0 ? comments.length / documents.length : 0;

    // Estimate time saved (more conservative calculation)
    const timeSaved = Math.round(
      documents.length * 0.5 + // 30 min saved per document through better organization
        versions.length * 0.2 + // 12 min saved per version through better tracking
        comments.length * 0.1 // 6 min saved per comment through better collaboration
    );

    // Calculate efficiency gains
    const collaborationRate =
      documents.filter((doc) => doc.sharedWith && doc.sharedWith.length > 0).length /
      documents.length;
    const efficiencyGain = Math.round(collaborationRate * 40); // Up to 40% efficiency gain from collaboration

    // Calculate completion rate based on archived documents
    const completedDocs = documents.filter((doc) => doc.archived).length;
    const completionRate =
      documents.length > 0 ? Math.round((completedDocs / documents.length) * 100) : 0;

    // More conservative cost savings estimate
    const costSavings = Math.round(timeSaved * 15); // $15/hour average (more realistic)

    return {
      timeSaved,
      efficiencyGain,
      collaborationIncrease: Math.round(collaborationRate * 100),
      documentCompletionRate: completionRate,
      costSavings,
      beforeAfterComparison: {
        before: {
          avgDocumentTime: 8, // hours (estimated)
          collaborationRate: 20, // percentage (estimated)
          completionRate: 60 // percentage (estimated)
        },
        after: {
          avgDocumentTime: Math.round(8 * (1 - efficiencyGain / 100)),
          collaborationRate: Math.round(collaborationRate * 100),
          completionRate: completionRate
        }
      }
    };
  }

  async getDocumentLifecycle(): Promise<DocumentLifecycle[]> {
    const documents = await this.documentsModel.find().exec();

    const lifecycle: DocumentLifecycle[] = [
      { stage: 'creation', count: 0, avgTimeInStage: 0, bottlenecks: [] },
      { stage: 'collaboration', count: 0, avgTimeInStage: 0, bottlenecks: [] },
      { stage: 'review', count: 0, avgTimeInStage: 0, bottlenecks: [] },
      { stage: 'completion', count: 0, avgTimeInStage: 0, bottlenecks: [] },
      { stage: 'archived', count: 0, avgTimeInStage: 0, bottlenecks: [] }
    ];

    // Categorize documents by stage
    documents.forEach((doc) => {
      if (doc.archived) {
        lifecycle[4].count++;
      } else if (doc.sharedWith && doc.sharedWith.length > 0) {
        lifecycle[1].count++; // collaboration
      } else {
        lifecycle[0].count++; // creation
      }
    });

    // Calculate average times (simplified)
    lifecycle[0].avgTimeInStage = 2; // 2 hours in creation
    lifecycle[1].avgTimeInStage = 8; // 8 hours in collaboration
    lifecycle[2].avgTimeInStage = 4; // 4 hours in review
    lifecycle[3].avgTimeInStage = 1; // 1 hour to completion
    lifecycle[4].avgTimeInStage = 0; // archived

    // Identify bottlenecks
    lifecycle[1].bottlenecks.push({
      stage: 'collaboration',
      avgTime: 8,
      description: 'Documents spend too long in collaboration phase'
    });

    return lifecycle;
  }

  async getTeamPerformanceInsights(): Promise<any> {
    const productivityScores = await this.getProductivityScores();
    const collaborationHealth = await this.getCollaborationHealth();
    const roiMetrics = await this.getROIMetrics();

    const topPerformers = productivityScores.slice(0, 3);
    const improvementAreas = productivityScores.slice(-3);

    return {
      topPerformers: {
        users: topPerformers.map((p) => ({
          name: p.userName,
          score: p.score,
          strengths: p.insights.filter(
            (i) => i.includes('High') || i.includes('excellent') || i.includes('active')
          )
        })),
        averageScore: Math.round(
          topPerformers.reduce((sum, p) => sum + p.score, 0) / topPerformers.length
        )
      },
      improvementAreas: {
        users: improvementAreas.map((p) => ({
          name: p.userName,
          score: p.score,
          needs: p.insights.filter((i) => i.includes('improvement') || i.includes('attention'))
        })),
        averageScore: Math.round(
          improvementAreas.reduce((sum, p) => sum + p.score, 0) / improvementAreas.length
        )
      },
      teamHealth: {
        collaborationScore: collaborationHealth.overallScore,
        bottlenecks: collaborationHealth.bottlenecks.length,
        recommendations: collaborationHealth.recommendations.length
      },
      businessImpact: {
        timeSaved: roiMetrics.timeSaved,
        efficiencyGain: roiMetrics.efficiencyGain,
        costSavings: roiMetrics.costSavings
      }
    };
  }
}
