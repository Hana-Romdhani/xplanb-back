import { Injectable } from '@nestjs/common';
import { Content } from './content.schema';
import { ContentRepository } from './content.repository';
import { createContentDTO } from './dto/create-content-dto';
import { DocumentsRepository } from '../document/document.repository';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../users/users.schema';
import { NotificationType } from '../notifications/notifications.schema';
import { Types } from 'mongoose';

@Injectable()
export class ContentService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly documentsRepository: DocumentsRepository,
    @InjectModel('Notification') private notificationModel: any,
    @InjectModel('User') private userModel: Model<User>
  ) {}

  async createContent(createContent: createContentDTO, userId: string): Promise<Content> {
    console.log(
      `📝 createContent called with documentId: ${createContent.documentId}, userId: ${userId}`
    );

    // Access level checking removed - all authenticated users can save content
    // Verify document exists
    const document = await this.documentsRepository.findOne(createContent.documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    console.log(`✅ Saving content...`);
    const result = await this.contentRepository.create(createContent);

    console.log(`✅ Content saved, creating notification...`);

    // Track document edit and create notification
    if (createContent.documentId) {
      await this.notifyDocumentEdit(createContent.documentId, userId);
    } else {
      console.log(`⚠️ No documentId provided, skipping notification`);
    }

    return result;
  }

  /**
   * Create notification for document edit
   */
  private async notifyDocumentEdit(documentId: string, actorId: string): Promise<void> {
    try {
      console.log(
        `🔔 Attempting to notify about document edit: docId=${documentId}, userId=${actorId}`
      );

      const document = await this.documentsRepository.findOne(documentId);
      if (!document || !document.createdBy) {
        console.log(`⚠️ Document not found or has no creator: ${documentId}`);
        return;
      }

      if (document.createdBy.toString() === actorId) {
        console.log(`✅ Same user, skipping notification`);
        return; // Don't notify yourself
      }

      console.log(
        `🔍 Document found - Creator: ${document.createdBy}, Editor: ${actorId}, Title: ${document.Title}`
      );

      const editingUser = await this.userModel.findById(actorId).select('firstName lastName');
      if (!editingUser) {
        console.log(`⚠️ Editing user not found: ${actorId}`);
        return;
      }

      console.log(`🔍 Editing user: ${editingUser.firstName} ${editingUser.lastName}`);

      // Check if notification already exists (deduplication)
      const existingNotification = await this.notificationModel.findOne({
        recipient: document.createdBy,
        type: NotificationType.DOCUMENT_EDITED,
        'metadata.documentId': documentId,
        'metadata.actorId': actorId,
        createdAt: { $gte: new Date(Date.now() - 60000) } // Within last minute
      });

      if (existingNotification) {
        console.log(`⏳ Notification already exists, skipping to avoid duplicates`);
        return;
      }

      // ALWAYS notify when someone edits, not just when shared
      const notification = await this.notificationModel.create({
        recipient: document.createdBy,
        title: 'Document Edited',
        message: `${editingUser.firstName} ${editingUser.lastName} edited "${document.Title}"`,
        type: NotificationType.DOCUMENT_EDITED,
        metadata: {
          documentId,
          actorId,
          documentTitle: document.Title
        }
      });

      console.log(
        `✅ Created edit notification with ID: ${notification._id} for document owner: ${document.createdBy}`
      );
    } catch (error) {
      console.error('❌ Failed to create edit notification:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        documentId,
        actorId
      });
    }
  }
  async getLastContent(id: string): Promise<Content> {
    const lastContent = await this.contentRepository.findLast(id);
    return lastContent;
  }
  async getAllContentst() {
    const contents = await this.contentRepository.findAll();
    return contents;
  }
  async getDocumentId(contentId: string): Promise<string | null> {
    return this.contentRepository.getDocumentId(contentId);
  }
  async getDocumentById(documentId: string): Promise<Content | null> {
    return this.contentRepository.findByDocumentId(documentId);
  }
  async getdocumentById(documentId: string): Promise<any> {
    return this.documentsRepository.findOne(documentId);
  }
}
