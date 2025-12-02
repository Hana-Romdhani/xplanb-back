import { Injectable } from '@nestjs/common';
import { Documents } from './document.schema';
import { DocumentsRepository } from './document.repository';
import { FolderRepository } from '../folder/folder.repository';
import { Folder } from 'src/folder/folder.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notifications.schema';
import { Model } from 'mongoose';
import { User } from '../users/users.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ContentRepository } from '../content/content.repository';
import PDFDocument = require('pdfkit');

@Injectable()
export class DocumentService {
  constructor(
    private DocRepositroy: DocumentsRepository,
    private folderRepository: FolderRepository,
    private contentRepository: ContentRepository,
    @InjectModel('Notification') private notificationModel: any,
    @InjectModel('User') private userModel: Model<User>
  ) {}

  async findAll(userId?: string) {
    return this.DocRepositroy.findAll(userId);
  }
  async findByFolderId(folderId: string, userId?: string): Promise<Documents[]> {
    // If userId is provided, check folder access permissions
    if (userId) {
      const folder = await this.folderRepository.findById(folderId);
      if (!folder) {
        throw new Error('Folder not found');
      }

      // Check if user has access to the folder
      const isOwner = folder.user?.toString() === userId;
      const isShared = folder.sharedWith?.some((user) => user._id.toString() === userId);

      if (!isOwner && !isShared) {
        throw new Error('Access denied: You do not have permission to view this folder');
      }
    }

    return this.DocRepositroy.findByFolderId(folderId);
  }

  async findOne(id: string) {
    return this.DocRepositroy.findOne(id);
  }

  async create(createDocValidator: any, userId?: string): Promise<Documents> {
    return this.DocRepositroy.create(createDocValidator, userId);
  }

  async createWithFolderId(
    folderId: string,
    createDocValidator: any,
    userId?: string
  ): Promise<Documents> {
    return this.DocRepositroy.createWithFolderId(folderId, createDocValidator, userId);
  }

  async update(id: string, createDocValidator: any, userId?: string) {
    try {
      console.log(`🔍 Backend Service: Updating document ${id}`, {
        userId,
        updateKeys: Object.keys(createDocValidator),
        hasTitle: !!createDocValidator.Title,
        hasContentType: !!createDocValidator.contentType,
        hasFolderId: !!createDocValidator.folderId
      });

      // Just verify the document exists - no permission checks
      const document = await this.DocRepositroy.findOne(id);
      if (!document) {
        throw new Error('Document not found');
      }

      // Update lastEditedBy if userId is provided
      if (userId && !createDocValidator.lastEditedBy) {
        createDocValidator.lastEditedBy = userId;
      }

      const result = await this.DocRepositroy.update(id, createDocValidator);
      console.log(`✅ Backend Service: Document updated successfully:`, {
        id: result._id,
        title: result.Title
      });
      return result;
    } catch (error) {
      console.error(`❌ Backend Service: Error updating document ${id}:`, error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        userId,
        updateData: createDocValidator
      });
      throw error;
    }
  }

  async remove(id: string) {
    return this.DocRepositroy.remove(id);
  }
  async findFolderById(id: string): Promise<Folder> {
    return this.folderRepository.findById(id);
  }

  /**
   * Helper to extract folderId string from populated or non-populated folderId
   */
  private extractFolderId(folderId: any): string | null {
    if (!folderId) return null;

    // If it's already a string, return it (but validate it first)
    if (typeof folderId === 'string') {
      if (Types.ObjectId.isValid(folderId)) {
        return folderId;
      }
      return null; // Invalid string ObjectId
    }

    // If it's an object (populated Mongoose document), get the _id first
    if (typeof folderId === 'object' && folderId !== null) {
      // For populated Mongoose documents, the _id is directly accessible
      if (folderId._id) {
        // _id might be an ObjectId or already a string
        if (Types.ObjectId.isValid(folderId._id)) {
          return folderId._id.toString();
        }
        if (typeof folderId._id === 'string' && Types.ObjectId.isValid(folderId._id)) {
          return folderId._id;
        }
      }

      // Check if the object itself is an ObjectId (but not a document)
      if (folderId.constructor && folderId.constructor.name === 'ObjectId') {
        return folderId.toString();
      }

      // Check if it's a valid ObjectId using isValid
      try {
        if (Types.ObjectId.isValid(folderId)) {
          return new Types.ObjectId(folderId).toString();
        }
      } catch (e) {
        // Not a valid ObjectId
      }
    }

    // If it's an ObjectId instance (not populated), convert to string
    try {
      if (Types.ObjectId.isValid(folderId)) {
        return new Types.ObjectId(folderId).toString();
      }
    } catch (e) {
      // Invalid ObjectId
    }

    // Last resort: if we still have a value, try to convert
    // This might fail, but at least we tried
    return null; // Don't return invalid string representations
  }
  async archivePost(id: string): Promise<Documents> {
    return this.DocRepositroy.archivePost(id);
  }
  async archivede(id: string): Promise<Documents> {
    return this.DocRepositroy.archivede(id);
  }

  /**
   * Dupliquer un document
   */
  async duplicateDocument(
    documentId: string,
    userId: string,
    newTitle?: string,
    targetFolderId?: string
  ): Promise<Documents> {
    try {
      // Récupérer le document original
      const originalDocument = await this.DocRepositroy.findOne(documentId);
      if (!originalDocument) {
        throw new Error('Document not found');
      }

      // Vérifier les permissions
      if (originalDocument.createdBy?.toString() !== userId) {
        throw new Error('Insufficient permissions to duplicate this document');
      }

      // Créer le nouveau document
      const duplicatedDocument = {
        Title: newTitle || `${originalDocument.Title} (Copy)`,
        contentType: originalDocument.contentType,
        folderId: targetFolderId || this.extractFolderId(originalDocument.folderId) || '',
        // Content is stored in Content collection, not Document collection
        createdBy: userId,
        version: 1,
        previousVersions: [],
        lastEditedBy: userId,
        sharedWith: [],
        defaultAccess: 'edit'
      };

      return this.DocRepositroy.create(duplicatedDocument);
    } catch (error) {
      throw new Error(`Failed to duplicate document: ${error.message}`);
    }
  }

  /**
   * Mettre à jour le contenu d'un document
   */
  async updateContent(documentId: string, content: any, userId: string): Promise<Documents> {
    try {
      // Vérifier que le document existe
      const document = await this.DocRepositroy.findOne(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Vérifier les permissions du document
      const isDocumentOwner = document.createdBy?.toString() === userId;
      const isDocumentShared = document.sharedWith?.some((id) => id.toString() === userId);
      console.log('🔐 [UPDATE_CONTENT] Document permissions check:', {
        documentId,
        userId,
        isDocumentOwner,
        isDocumentShared
      });

      // Vérifier les permissions du dossier si le document appartient à un dossier
      let hasFolderEditAccess = true;
      if (document.folderId) {
        try {
          // Extract folderId safely - handle populated Mongoose documents
          let folderIdString: string | null = null;

          if (typeof document.folderId === 'string') {
            folderIdString = document.folderId;
          } else if (document.folderId && typeof document.folderId === 'object') {
            // Handle populated Mongoose document - access _id property directly
            if (document.folderId._id !== undefined && document.folderId._id !== null) {
              // _id exists, convert to string safely
              const idValue = document.folderId._id;
              // If _id is already a string and valid, use it
              if (typeof idValue === 'string' && Types.ObjectId.isValid(idValue)) {
                folderIdString = idValue;
              } else if (Types.ObjectId.isValid(idValue)) {
                // It's an ObjectId, convert safely
                folderIdString = new Types.ObjectId(idValue).toString();
              }
            } else if (Types.ObjectId.isValid(document.folderId)) {
              // It's an ObjectId itself, not populated
              folderIdString = new Types.ObjectId(document.folderId).toString();
            }
          }

          if (folderIdString && Types.ObjectId.isValid(folderIdString)) {
            const folder = await this.folderRepository.findById(folderIdString);
            if (folder) {
              const isFolderOwner = folder.user?.toString() === userId;
              const isFolderShared = folder.sharedWith?.some(
                (user) => user._id?.toString() === userId
              );
              // Check per-user access level
              const userAccess = folder.userAccess?.find((ua) => ua.userId.toString() === userId);
              // Fixed: check for both 'edit' and 'update' for backwards compatibility
              const hasEditAccess = userAccess
                ? userAccess.access === 'edit' || userAccess.access === 'update'
                : false;
              console.log('🔐 Folder permissions check:', {
                folderIdString,
                userId,
                isFolderOwner,
                isFolderShared,
                userAccessLevel: userAccess?.access,
                hasEditAccess
              });

              hasFolderEditAccess = isFolderOwner || (isFolderShared && hasEditAccess);
            }
          }
        } catch (folderError) {
          console.error('Error checking folder permissions in updateContent:', folderError);
          // If we can't check folder permissions, allow access (fail open)
          // This prevents blocking users due to data inconsistency
        }
      }

      // L'utilisateur doit avoir soit les permissions du document soit les permissions du dossier
      console.log('🔐 Final permission decision:', {
        isDocumentOwner,
        isDocumentShared,
        hasFolderEditAccess,
        allowed: isDocumentOwner || isDocumentShared || hasFolderEditAccess
      });
      if (!isDocumentOwner && !isDocumentShared && !hasFolderEditAccess) {
        throw new Error(
          'Insufficient permissions to update this document. Check folder access rights.'
        );
      }

      // Mettre à jour le contenu - only update metadata, not content
      // Content is stored in Content collection, not Document collection
      const updated = await this.DocRepositroy.update(documentId, {
        lastEditedBy: userId,
        updatedDate: new Date()
      });

      // NOTE: Notifications for edits are now handled in content.service.ts when content is actually saved
      // This prevents duplicate notifications

      return updated;
    } catch (error) {
      throw new Error(`Failed to update document content: ${error.message}`);
    }
  }

  /**
   * Track document view
   */
  async trackView(documentId: string, userId: string): Promise<void> {
    try {
      const document = await this.DocRepositroy.findOne(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Check if user has already viewed this document
      const hasViewed = document.viewedBy?.some((id) => id.toString() === userId);

      if (!hasViewed) {
        await this.DocRepositroy.update(documentId, {
          $inc: { viewCount: 1 },
          $push: { viewedBy: userId },
          lastViewedAt: new Date()
        });
      } else {
        // Update last viewed time even if already viewed
        await this.DocRepositroy.update(documentId, {
          lastViewedAt: new Date()
        });
      }

      // NOTE: Removed notification creation from here since it's handled in realtime.service.ts
      // This prevents duplicate notifications when someone joins a document via WebSocket
    } catch (error) {
      console.error('Failed to track document view:', error);
    }
  }

  /**
   * Track document edit
   */
  async trackEdit(documentId: string, userId: string): Promise<void> {
    try {
      await this.DocRepositroy.update(documentId, {
        $inc: { editCount: 1 },
        lastEditedBy: userId,
        updatedDate: new Date()
      });
    } catch (error) {
      console.error('Failed to track document edit:', error);
    }
  }

  /**
   * Track document comment
   */
  async trackComment(documentId: string): Promise<void> {
    try {
      await this.DocRepositroy.update(documentId, {
        $inc: { commentCount: 1 }
      });
    } catch (error) {
      console.error('Failed to track document comment:', error);
    }
  }

  /**
   * Track document share
   */
  async trackShare(documentId: string): Promise<void> {
    try {
      await this.DocRepositroy.update(documentId, {
        $inc: { shareCount: 1 }
      });
    } catch (error) {
      console.error('Failed to track document share:', error);
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(documentId: string): Promise<any> {
    try {
      const document = await this.DocRepositroy.findOne(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      return {
        viewCount: document.viewCount || 0,
        editCount: document.editCount || 0,
        commentCount: document.commentCount || 0,
        shareCount: document.shareCount || 0,
        lastViewedAt: document.lastViewedAt ? new Date(document.lastViewedAt).toISOString() : null,
        lastEditedBy: document.lastEditedBy,
        createdDate: document.createdDate
          ? new Date(document.createdDate).toISOString()
          : new Date().toISOString(),
        updatedDate: document.updatedDate
          ? new Date(document.updatedDate).toISOString()
          : new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get document stats: ${error.message}`);
    }
  }

  /**
   * Create notification for shared document activity
   */
  private async createNotificationForSharedDocument(
    documentOwnerId: string | undefined,
    actorId: string,
    actorName: string,
    documentTitle: string,
    documentId: string,
    type: NotificationType
  ): Promise<void> {
    try {
      if (!documentOwnerId || documentOwnerId === actorId) {
        return; // Don't notify yourself
      }

      const title = this.getNotificationTitle(type, actorName);
      const message = this.getNotificationMessage(type, actorName, documentTitle);

      await this.notificationModel.create({
        recipient: new Types.ObjectId(documentOwnerId),
        title,
        message,
        type,
        metadata: {
          documentId,
          actorId,
          documentTitle
        }
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }

  private getNotificationTitle(type: NotificationType, actorName: string): string {
    switch (type) {
      case NotificationType.DOCUMENT_VIEWED:
        return 'Document Viewed';
      case NotificationType.DOCUMENT_EDITED:
        return 'Document Edited';
      case NotificationType.DOCUMENT_COMMENTED:
        return 'New Comment';
      default:
        return 'Document Activity';
    }
  }

  private getNotificationMessage(
    type: NotificationType,
    actorName: string,
    documentTitle: string
  ): string {
    switch (type) {
      case NotificationType.DOCUMENT_VIEWED:
        return `${actorName} viewed "${documentTitle}"`;
      case NotificationType.DOCUMENT_EDITED:
        return `${actorName} edited "${documentTitle}"`;
      case NotificationType.DOCUMENT_COMMENTED:
        return `${actorName} commented on "${documentTitle}"`;
      default:
        return `${actorName} performed an action on "${documentTitle}"`;
    }
  }

  /**
   * Add document to user's favorites
   */
  async favoriteDocument(documentId: string, userId: string): Promise<Documents> {
    const document = await this.DocRepositroy.findOne(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Check if already favorited
    const isFavorited = document.favoritedBy?.some((id: any) => id.toString() === userId);

    if (isFavorited) {
      return document; // Already favorited, return as-is
    }

    // Add user to favoritedBy array
    return this.DocRepositroy.update(documentId, {
      $addToSet: { favoritedBy: userId }
    });
  }

  /**
   * Remove document from user's favorites
   */
  async unfavoriteDocument(documentId: string, userId: string): Promise<Documents> {
    const document = await this.DocRepositroy.findOne(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Remove user from favoritedBy array
    return this.DocRepositroy.update(documentId, {
      $pull: { favoritedBy: userId }
    });
  }

  /**
   * Get all favorited documents for a user
   */
  async getFavoriteDocuments(userId: string): Promise<Documents[]> {
    return this.DocRepositroy.findFavoriteDocuments(userId);
  }

  /**
   * Share document with a user
   */
  async shareDocument(
    documentId: string,
    userIdToShareWith: string,
    access: 'view' | 'edit' = 'view',
    currentUserId: string
  ): Promise<Documents> {
    const document = await this.DocRepositroy.findOne(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Check if current user is the owner
    if (document.createdBy?.toString() !== currentUserId) {
      throw new Error('Only the document owner can share the document');
    }

    // Check if target user exists
    const targetUser = await this.userModel.findById(userIdToShareWith);
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Add user to sharedWith if not already there
    const isAlreadyShared = document.sharedWith?.some((id) => id.toString() === userIdToShareWith);
    if (!isAlreadyShared) {
      await this.DocRepositroy.update(documentId, {
        $addToSet: { sharedWith: userIdToShareWith }
      });
    }

    // Update or add user access level
    const existingUserAccess = document.userAccess || [];
    const userAccessIndex = existingUserAccess.findIndex(
      (ua) => ua.userId.toString() === userIdToShareWith
    );

    if (userAccessIndex >= 0) {
      existingUserAccess[userAccessIndex].access = access;
    } else {
      existingUserAccess.push({ userId: new Types.ObjectId(userIdToShareWith), access });
    }

    await this.DocRepositroy.update(documentId, {
      userAccess: existingUserAccess
    });

    await this.trackShare(documentId);
    return this.DocRepositroy.findOne(documentId);
  }

  /**
   * Share document by email
   */
  async shareDocumentByEmail(
    documentId: string,
    email: string,
    access: 'view' | 'edit' = 'view',
    currentUserId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const document = await this.DocRepositroy.findOne(documentId);
      if (!document) {
        return { success: false, message: 'Document not found' };
      }

      // Check if current user is the owner
      if (document.createdBy?.toString() !== currentUserId) {
        return { success: false, message: 'Only the document owner can share the document' };
      }

      // Check if user exists
      const targetUser = await this.userModel.findOne({ email });
      if (!targetUser) {
        return { success: false, message: 'User with this email does not exist' };
      }

      // Check if user is already shared
      const isAlreadyShared = document.sharedWith?.some(
        (id) => id.toString() === targetUser._id.toString()
      );
      if (isAlreadyShared) {
        return { success: false, message: 'User is already shared with this document' };
      }

      // Add user to sharedWith
      await this.DocRepositroy.update(documentId, {
        $addToSet: { sharedWith: targetUser._id }
      });

      // Update user access level
      const existingUserAccess = document.userAccess || [];
      const userAccessIndex = existingUserAccess.findIndex(
        (ua) => ua.userId.toString() === targetUser._id.toString()
      );

      if (userAccessIndex >= 0) {
        existingUserAccess[userAccessIndex].access = access;
      } else {
        // Convert userId to ObjectId
        const userIdObjectId =
          typeof targetUser._id === 'string' ? new Types.ObjectId(targetUser._id) : targetUser._id;
        existingUserAccess.push({ userId: userIdObjectId, access });
      }

      await this.DocRepositroy.update(documentId, {
        userAccess: existingUserAccess
      });

      await this.trackShare(documentId);
      return { success: true, message: 'Document shared successfully' };
    } catch (error) {
      console.error('Failed to share document by email:', error);
      return { success: false, message: 'Failed to share document' };
    }
  }

  /**
   * Get user's access level for a document
   */
  async getUserAccessLevel(documentId: string, userId: string): Promise<string> {
    try {
      const document = await this.DocRepositroy.findOne(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Owner always has full access
      if (document.createdBy?.toString() === userId) {
        return 'edit';
      }

      // Check user-specific access level
      const userAccess = document.userAccess?.find((ua) => ua.userId.toString() === userId);
      if (userAccess) {
        // Ensure we only return 'view' or 'edit' (convert 'update' to 'edit' if exists)
        return userAccess.access === 'update' ? 'edit' : userAccess.access;
      }

      // Check if user is in sharedWith (default to view)
      const isShared = document.sharedWith?.some((id) => id.toString() === userId);
      if (isShared) {
        const defaultAccess = document.defaultAccess || 'view';
        // Convert 'update' or 'comment' to 'edit' for documents
        return defaultAccess === 'update' || defaultAccess === 'comment' ? 'edit' : 'view';
      }

      // Check folder access
      if (document.folderId) {
        let folderIdString: string | null = null;
        if (typeof document.folderId === 'string') {
          folderIdString = document.folderId;
        } else if (document.folderId && typeof document.folderId === 'object') {
          if (document.folderId._id !== undefined && document.folderId._id !== null) {
            const idValue = document.folderId._id;
            if (typeof idValue === 'string' && Types.ObjectId.isValid(idValue)) {
              folderIdString = idValue;
            } else if (Types.ObjectId.isValid(idValue)) {
              folderIdString = new Types.ObjectId(idValue).toString();
            }
          } else if (Types.ObjectId.isValid(document.folderId)) {
            folderIdString = new Types.ObjectId(document.folderId).toString();
          }
        }

        if (folderIdString && Types.ObjectId.isValid(folderIdString)) {
          const folder = await this.folderRepository.findById(folderIdString);
          if (folder) {
            const isFolderOwner = folder.user?.toString() === userId;
            if (isFolderOwner) {
              return 'edit';
            }
            const isFolderShared = folder.sharedWith?.some(
              (user) => user._id?.toString() === userId
            );
            if (isFolderShared) {
              const folderUserAccess = folder.userAccess?.find(
                (ua) => ua.userId.toString() === userId
              );
              return folderUserAccess ? folderUserAccess.access : 'view';
            }
          }
        }
      }

      return 'none';
    } catch (error) {
      console.error('Failed to get user access level:', error);
      return 'none';
    }
  }

  /**
   * Get shared users for a document
   */
  async getSharedUsers(documentId: string): Promise<any[]> {
    try {
      const document = await this.DocRepositroy.findOne(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      if (!document.sharedWith || document.sharedWith.length === 0) {
        return [];
      }

      // Populate sharedWith users
      const populatedDoc = await this.DocRepositroy.findOne(documentId);
      if (!populatedDoc || !populatedDoc.sharedWith) {
        return [];
      }

      // Get user access levels
      const userAccessMap = new Map();
      if (document.userAccess) {
        document.userAccess.forEach((ua) => {
          userAccessMap.set(ua.userId.toString(), ua.access);
        });
      }

      // Map shared users with their access levels
      const sharedUsers = [];
      for (const userId of document.sharedWith) {
        const user = await this.userModel.findById(userId);
        if (user) {
          let access = userAccessMap.get(userId.toString()) || document.defaultAccess || 'view';
          // Normalize access: convert 'update' or 'comment' to 'edit' for documents
          if (access === 'update' || access === 'comment') {
            access = 'edit';
          } else if (access !== 'view' && access !== 'edit') {
            access = 'view'; // Default to 'view' for any other values
          }
          sharedUsers.push({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            access: access
          });
        }
      }

      return sharedUsers;
    } catch (error) {
      console.error('Failed to get shared users:', error);
      return [];
    }
  }

  /**
   * Remove user from document sharing
   */
  async removeUserFromDocument(
    documentId: string,
    userIdToRemove: string,
    currentUserId: string
  ): Promise<Documents> {
    const document = await this.DocRepositroy.findOne(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Check if current user is the owner
    if (document.createdBy?.toString() !== currentUserId) {
      throw new Error('Only the document owner can remove users from the document');
    }

    // Remove user from sharedWith
    await this.DocRepositroy.update(documentId, {
      $pull: { sharedWith: userIdToRemove }
    });

    // Remove user from userAccess
    const existingUserAccess = document.userAccess || [];
    const filteredUserAccess = existingUserAccess.filter(
      (ua) => ua.userId.toString() !== userIdToRemove
    );

    await this.DocRepositroy.update(documentId, {
      userAccess: filteredUserAccess
    });

    return this.DocRepositroy.findOne(documentId);
  }

  /**
   * Generate PDF for a document
   */
  async generatePDF(documentId: string, userId: string): Promise<Buffer> {
    try {
      // Get document metadata
      const document = await this.DocRepositroy.findOne(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Get document content
      const content = await this.contentRepository.findByDocumentId(documentId);
      if (!content || !content.content) {
        throw new Error('Document content not found');
      }

      // Parse content
      let contentData: any;
      try {
        contentData =
          typeof content.content === 'string' ? JSON.parse(content.content) : content.content;
      } catch (parseError) {
        throw new Error('Failed to parse document content');
      }

      // Create PDF
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: document.Title || 'Untitled Document',
          Author: 'Document Management System',
          Creator: 'XPlanB'
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));

      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        doc.on('error', (error) => {
          reject(error);
        });

        // Add title
        doc
          .fontSize(24)
          .font('Helvetica-Bold')
          .text(document.Title || 'Untitled Document', { align: 'center' })
          .moveDown(1);

        // Add tags if available
        if (document.contentType && document.contentType.length > 0) {
          doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#666666')
            .text(`Tags: ${document.contentType.join(', ')}`, { align: 'center' })
            .moveDown(1);
        }

        // Add separator
        doc
          .moveDown(0.5)
          .strokeColor('#e5e7eb')
          .lineWidth(1)
          .moveTo(50, doc.y)
          .lineTo(550, doc.y)
          .stroke()
          .moveDown(1);

        // Reset font
        doc.font('Helvetica').fontSize(12).fillColor('#000000');

        // Process blocks
        const blocks = contentData.blocks || [];
        blocks.forEach((block: any) => {
          switch (block.type) {
            case 'header': {
              const level = block.data?.level || 2;
              const fontSize = level === 1 ? 20 : level === 2 ? 18 : level === 3 ? 16 : 14;
              const text = block.data?.text || block.data?.content || '';
              // Remove HTML tags
              const cleanText = text.replace(/<[^>]*>/g, '');
              doc
                .fontSize(fontSize)
                .font('Helvetica-Bold')
                .text(cleanText, { align: 'left' })
                .moveDown(0.5);
              break;
            }
            case 'paragraph': {
              const text = block.data?.text || block.data?.content || '';
              const cleanText = text.replace(/<[^>]*>/g, '');
              doc
                .fontSize(12)
                .font('Helvetica')
                .text(cleanText, { align: 'left', paragraphGap: 5 })
                .moveDown(0.5);
              break;
            }
            case 'list': {
              const items = block.data?.items || [];
              const isOrdered = block.data?.style === 'ordered';
              items.forEach((item: any, index: number) => {
                const itemText =
                  typeof item === 'string'
                    ? item.replace(/<[^>]*>/g, '')
                    : (item?.text || item?.content || String(item || '')).replace(/<[^>]*>/g, '');
                const prefix = isOrdered ? `${index + 1}. ` : '• ';
                doc.fontSize(12).font('Helvetica').text(`${prefix}${itemText}`, {
                  align: 'left',
                  indent: 20,
                  paragraphGap: 3
                });
              });
              doc.moveDown(0.5);
              break;
            }
            case 'checklist': {
              const items = block.data?.items || [];
              items.forEach((item: any) => {
                const itemText = (item?.text || item?.content || String(item || '')).replace(
                  /<[^>]*>/g,
                  ''
                );
                const checked = item?.checked ? '☑' : '☐';
                doc.fontSize(12).font('Helvetica').text(`${checked} ${itemText}`, {
                  align: 'left',
                  indent: 20,
                  paragraphGap: 3
                });
              });
              doc.moveDown(0.5);
              break;
            }
            case 'quote': {
              const text = block.data?.text || block.data?.content || '';
              const cleanText = text.replace(/<[^>]*>/g, '');
              const caption = block.data?.caption || '';
              doc
                .fontSize(12)
                .font('Helvetica-Oblique')
                .fillColor('#374151')
                .text(`"${cleanText}"`, {
                  align: 'left',
                  indent: 30,
                  paragraphGap: 5
                });
              if (caption) {
                doc.fontSize(10).text(`— ${caption.replace(/<[^>]*>/g, '')}`, {
                  align: 'right',
                  indent: 30
                });
              }
              doc.fillColor('#000000').moveDown(0.5);
              break;
            }
            case 'code': {
              const code = block.data?.code || block.data?.content || '';
              const cleanCode = code.replace(/<[^>]*>/g, '');
              doc
                .fontSize(10)
                .font('Courier')
                .fillColor('#111827')
                .text(cleanCode, {
                  align: 'left',
                  indent: 20,
                  paragraphGap: 5
                })
                .fillColor('#000000')
                .moveDown(0.5);
              break;
            }
            case 'table': {
              const tableData = block.data?.content || [];
              if (tableData.length > 0) {
                const [header, ...rows] = tableData;
                // Simple table rendering - could be improved
                if (header && header.length > 0) {
                  const cellWidth = 500 / header.length;
                  header.forEach((cell: any, i: number) => {
                    const cellText = (typeof cell === 'string' ? cell : String(cell || '')).replace(
                      /<[^>]*>/g,
                      ''
                    );
                    doc
                      .fontSize(10)
                      .font('Helvetica-Bold')
                      .text(cellText.substring(0, 30), 50 + i * cellWidth, doc.y, {
                        width: cellWidth - 10,
                        height: 20
                      });
                  });
                  doc.moveDown(1);
                }
                rows.forEach((row: any[]) => {
                  const cellWidth = 500 / (row.length || 1);
                  row.forEach((cell: any, i: number) => {
                    const cellText = (typeof cell === 'string' ? cell : String(cell || '')).replace(
                      /<[^>]*>/g,
                      ''
                    );
                    doc
                      .fontSize(10)
                      .font('Helvetica')
                      .text(cellText.substring(0, 30), 50 + i * cellWidth, doc.y, {
                        width: cellWidth - 10,
                        height: 20
                      });
                  });
                  doc.moveDown(1);
                });
                doc.moveDown(0.5);
              }
              break;
            }
            case 'delimiter': {
              doc
                .moveDown(0.5)
                .strokeColor('#d1d5db')
                .lineWidth(1)
                .moveTo(200, doc.y)
                .lineTo(400, doc.y)
                .stroke()
                .moveDown(1);
              break;
            }
            default:
              // Handle unknown block types
              if (block.data?.text) {
                const text = block.data.text.replace(/<[^>]*>/g, '');
                doc.fontSize(12).font('Helvetica').text(text, { align: 'left' }).moveDown(0.5);
              }
          }
        });

        // Finalize PDF
        doc.end();
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }
}
