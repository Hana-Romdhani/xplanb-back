import { Injectable } from '@nestjs/common';
import { Comment } from './comments.schema';
import { CommentsRepository } from './comments.repository';
import { CommentsGateway } from './comments.Gateway';
import { DocumentService } from '../document/document.service';
import { Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationType } from '../notifications/notifications.schema';
import { User } from '../users/users.schema';

@Injectable()
export class CommentsService {
  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly appGateway: CommentsGateway,
    private readonly documentService: DocumentService,
    @InjectModel('Notification') private notificationModel: any,
    @InjectModel('User') private userModel: Model<User>
  ) {}

  async create(comment: Comment): Promise<Comment> {
    console.log(`💬 Creating comment on document: ${comment.document}, by user: ${comment.user}`);

    const newComment = await this.commentsRepository.create({
      ...comment,
      user: new Types.ObjectId(comment.user as any) as any
    });

    console.log(`✅ Comment created with ID: ${newComment._id}`);

    // Track comment in document statistics
    if (comment.document) {
      await this.documentService.trackComment(comment.document.toString());

      console.log(`📢 Creating notification for document owner...`);

      // Create notification for document owner about the comment
      await this.notifyDocumentOwnerAboutComment(
        comment.document.toString(),
        comment.user.toString()
      );
    } else {
      console.log(`⚠️ No document ID in comment, skipping notification`);
    }

    this.appGateway.server.emit('newComment', newComment);
    return newComment;
  }

  /**
   * Create notification for document owner when someone comments
   */
  private async notifyDocumentOwnerAboutComment(
    documentId: string,
    commenterId: string
  ): Promise<void> {
    try {
      console.log(
        `🔔 Attempting to notify about comment: docId=${documentId}, userId=${commenterId}`
      );

      const document = await this.documentService.findOne(documentId);
      if (!document) {
        console.log(`⚠️ Document not found: ${documentId}`);
        return;
      }

      if (!document.createdBy) {
        console.log(`⚠️ Document has no creator: ${documentId}`);
        return;
      }

      if (document.createdBy.toString() === commenterId) {
        console.log(`✅ Same user, skipping notification`);
        return; // Don't notify yourself
      }

      console.log(
        `🔍 Document found - Creator: ${document.createdBy}, Commenter: ${commenterId}, Title: ${document.Title}`
      );

      const commenter = await this.userModel.findById(commenterId).select('firstName lastName');
      if (!commenter) {
        console.log(`⚠️ Commenter user not found: ${commenterId}`);
        return;
      }

      console.log(`🔍 Commenter: ${commenter.firstName} ${commenter.lastName}`);

      // Check if notification already exists (deduplication)
      const existingNotification = await this.notificationModel.findOne({
        recipient: document.createdBy,
        type: NotificationType.DOCUMENT_COMMENTED,
        'metadata.documentId': documentId,
        'metadata.actorId': commenterId,
        createdAt: { $gte: new Date(Date.now() - 60000) } // Within last minute
      });

      if (existingNotification) {
        console.log(`⏳ Notification already exists, skipping to avoid duplicates`);
        return;
      }

      // ALWAYS notify when someone comments, not just when shared
      const notification = await this.notificationModel.create({
        recipient: document.createdBy,
        title: 'New Comment',
        message: `${commenter.firstName} ${commenter.lastName} commented on "${document.Title}"`,
        type: NotificationType.DOCUMENT_COMMENTED,
        metadata: {
          documentId,
          actorId: commenterId,
          documentTitle: document.Title
        }
      });

      console.log(
        `✅ Created comment notification with ID: ${notification._id} for document owner: ${document.createdBy}`
      );
    } catch (error) {
      console.error('❌ Failed to create comment notification:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        documentId,
        commenterId
      });
    }
  }

  async findAll(documentId: string): Promise<Comment[]> {
    return this.commentsRepository.findAll(documentId);
  }

  async findOne(id: string): Promise<Comment> {
    return this.commentsRepository.findOne(id);
  }

  async update(id: string, comment: Comment): Promise<Comment> {
    const updated = await this.commentsRepository.update(id, comment);
    this.appGateway.server.emit('newComment', comment);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.commentsRepository.remove(id);
    this.appGateway.server.emit('commentDeleted', { id });
  }
}
