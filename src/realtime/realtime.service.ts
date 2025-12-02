/**
 * Realtime Service
 *
 * Service pour la gestion de la co-édition temps-réel avec WebSocket
 * Gère les rooms, la persistance automatique et l'état des utilisateurs connectés
 *
 * Emplacement: src/realtime/realtime.service.ts
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Documents, DocumentsDocument } from '../document/document.schema';
import { DocumentVersion, DocumentVersionDocument } from '../document/document-version.schema';
import { User, UserDocument } from '../users/users.schema';
import { Content } from '../content/content.schema';
import { Notification, NotificationDocument } from '../notifications/notifications.schema';

interface ConnectedUser {
  id: string;
  name: string;
  color: string;
  socketId: string;
  avatar?: string;
  cursor?: {
    x: number;
    y: number;
    blockId?: string;
  };
  lastSeen: Date;
}

interface DocumentRoom {
  documentId: string;
  users: Map<string, ConnectedUser>;
  content: any;
  lastSaved: Date;
  autoSaveInterval?: NodeJS.Timeout;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private rooms = new Map<string, DocumentRoom>();
  private userColors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E9'
  ];

  constructor(
    @InjectModel(Documents.name) private documentsModel: Model<DocumentsDocument>,
    @InjectModel(DocumentVersion.name) private documentVersionModel: Model<DocumentVersionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Content.name) private contentModel: Model<Content>,
    @InjectModel('Notification') private notificationModel: Model<NotificationDocument>
  ) {}

  /**
   * Ajoute un utilisateur à une room de document
   */
  async joinDocument(
    documentId: string,
    userId: string,
    socketId: string
  ): Promise<{ success: boolean; content?: any; users: ConnectedUser[] }> {
    try {
      // No access check - allow everyone to join any document

      // Create notification for document owner when someone joins
      await this.notifyDocumentOwnerAboutJoin(documentId, userId);

      // Récupérer ou créer la room
      let room = this.rooms.get(documentId);
      if (!room) {
        room = {
          documentId,
          users: new Map(),
          content: null,
          lastSaved: new Date()
        };
        this.rooms.set(documentId, room);
      }

      // Récupérer les infos utilisateur
      const user = await this.userModel.findById(userId).select('firstName lastName picture');
      if (!user) {
        return { success: false, users: [] };
      }

      // Générer une couleur pour l'utilisateur
      const color = this.getUserColor(room.users.size);

      // Ajouter l'utilisateur à la room
      const connectedUser: ConnectedUser = {
        id: userId,
        name: `${user.firstName} ${user.lastName}`,
        color,
        socketId,
        avatar: user.picture || undefined,
        lastSeen: new Date()
      };

      room.users.set(userId, connectedUser);

      // Charger le contenu du document si pas encore fait
      if (!room.content) {
        // Load content from Content collection, not Document collection
        const content = await this.contentModel.findOne({ documentId }).sort({ creationDate: -1 });
        if (content) {
          try {
            room.content = JSON.parse(content.content);
          } catch (error) {
            room.content = {};
          }
        } else {
          room.content = {};
        }
      }

      // Démarrer l'auto-save si c'est le premier utilisateur
      if (room.users.size === 1) {
        this.startAutoSave(documentId);
      }

      this.logger.log(`User ${userId} joined document ${documentId}`);

      return {
        success: true,
        content: room.content,
        users: Array.from(room.users.values())
      };
    } catch (error) {
      this.logger.error(`Error joining document: ${error.message}`);
      return { success: false, users: [] };
    }
  }

  /**
   * Retire un utilisateur d'une room
   */
  leaveDocument(documentId: string, userId: string): void {
    const room = this.rooms.get(documentId);
    if (room) {
      room.users.delete(userId);

      // Arrêter l'auto-save si plus d'utilisateurs
      if (room.users.size === 0) {
        this.stopAutoSave(documentId);
        this.rooms.delete(documentId);
      }

      this.logger.log(`User ${userId} left document ${documentId}`);
    }
  }

  /**
   * Met à jour le contenu d'un document
   */
  async updateContent(documentId: string, content: any, userId: string): Promise<boolean> {
    try {
      const room = this.rooms.get(documentId);
      if (!room) return false;

      room.content = content;
      room.lastSaved = new Date();

      // Increment version number
      const document = await this.documentsModel.findById(documentId);
      if (!document) return false;

      // Mettre à jour le document avec version incrémentée et editCount
      await this.documentsModel.findByIdAndUpdate(documentId, {
        lastEditedBy: userId,
        updatedDate: new Date(),
        $inc: {
          version: 1, // Increment version
          editCount: 1 // Increment edit count
        }
      });

      this.logger.debug(
        `Content updated for document ${documentId} by user ${userId} - version ${document.version + 1}`
      );
      return true;
    } catch (error) {
      this.logger.error(`Error updating content: ${error.message}`);
      return false;
    }
  }

  /**
   * Met à jour la position du curseur d'un utilisateur
   */
  updateCursor(documentId: string, userId: string, cursor: any): void {
    const room = this.rooms.get(documentId);
    if (room && room.users.has(userId)) {
      const user = room.users.get(userId);
      if (user) {
        user.cursor = cursor;
        user.lastSeen = new Date();
      }
    }
  }

  /**
   * Sauvegarde automatique du contenu
   */
  async saveSnapshot(documentId: string, description?: string): Promise<boolean> {
    try {
      const room = this.rooms.get(documentId);
      if (!room || !room.content) return false;

      // Convert content object to JSON string for storage
      const contentString =
        typeof room.content === 'string' ? room.content : JSON.stringify(room.content);

      // Sauvegarder le contenu dans la collection Content (pas Documents)
      await this.contentModel.create({
        documentId,
        content: contentString,
        creationDate: new Date()
      });

      this.logger.log(`Snapshot saved for document ${documentId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error saving snapshot: ${error.message}`);
      return false;
    }
  }

  /**
   * Récupère la liste des utilisateurs connectés à un document
   */
  getConnectedUsers(documentId: string): ConnectedUser[] {
    const room = this.rooms.get(documentId);
    return room ? Array.from(room.users.values()) : [];
  }

  /**
   * Récupère le nombre total d'utilisateurs connectés à travers tous les documents
   */
  getTotalConnectedUsersCount(): number {
    const uniqueUserIds = new Set<string>();
    this.rooms.forEach((room) => {
      room.users.forEach((user) => {
        uniqueUserIds.add(user.id);
      });
    });
    return uniqueUserIds.size;
  }

  /**
   * Génère une couleur unique pour l'utilisateur
   */
  private getUserColor(index: number): string {
    return this.userColors[index % this.userColors.length];
  }

  /**
   * Démarre l'auto-save pour un document
   */
  private startAutoSave(documentId: string): void {
    const room = this.rooms.get(documentId);
    if (room && !room.autoSaveInterval) {
      room.autoSaveInterval = setInterval(async () => {
        await this.saveSnapshot(documentId);
      }, 30000); // Sauvegarde toutes les 30 secondes
    }
  }

  /**
   * Arrête l'auto-save pour un document
   */
  private stopAutoSave(documentId: string): void {
    const room = this.rooms.get(documentId);
    if (room && room.autoSaveInterval) {
      clearInterval(room.autoSaveInterval);
      room.autoSaveInterval = undefined;
    }
  }

  private lastNotificationTimes = new Map<string, Map<string, Date>>(); // documentId -> userId -> last notification time

  /**
   * Notify document owner when someone joins their document
   */
  private async notifyDocumentOwnerAboutJoin(
    documentId: string,
    joiningUserId: string
  ): Promise<void> {
    try {
      this.logger.debug(
        `🔔 Attempting to notify about document join: docId=${documentId}, userId=${joiningUserId}`
      );

      // Check if we recently notified about this (throttle to once per minute per user)
      const lastNotifKey = `doc-${documentId}-user-${joiningUserId}`;
      const lastNotification = this.getLastNotificationTime(documentId, joiningUserId);
      const now = new Date();
      if (lastNotification && now.getTime() - lastNotification.getTime() < 60000) {
        this.logger.debug(`⏳ Skipping duplicate notification (throttled)`);
        return;
      }

      const document = await this.documentsModel.findById(documentId);
      if (!document) {
        this.logger.warn(`⚠️ Document not found: ${documentId}`);
        return;
      }

      if (!document.createdBy) {
        this.logger.warn(`⚠️ Document has no creator: ${documentId}`);
        return;
      }

      if (document.createdBy.toString() === joiningUserId) {
        this.logger.debug(`✅ Same user, skipping notification`);
        return; // Don't notify yourself
      }

      this.logger.debug(
        `🔍 Document found - Creator: ${document.createdBy}, Viewer: ${joiningUserId}, Title: ${document.Title}`
      );

      const joiningUser = await this.userModel.findById(joiningUserId).select('firstName lastName');
      if (!joiningUser) {
        this.logger.warn(`⚠️ Joining user not found: ${joiningUserId}`);
        return;
      }

      this.logger.debug(`🔍 Joining user: ${joiningUser.firstName} ${joiningUser.lastName}`);

      // Create notification
      await this.notificationModel.create({
        recipient: document.createdBy,
        title: 'Document Viewed',
        message: `${joiningUser.firstName} ${joiningUser.lastName} is viewing "${document.Title}"`,
        type: 'document_viewed' as any,
        metadata: {
          documentId,
          actorId: joiningUserId,
          documentTitle: document.Title
        }
      });

      // Track this notification time
      this.setLastNotificationTime(documentId, joiningUserId, now);

      this.logger.log(
        `✅ Created notification for document owner: ${document.createdBy} about user ${joiningUserId}`
      );
    } catch (error) {
      this.logger.error(`❌ Failed to create join notification: ${error.message}`);
      this.logger.error(error);
    }
  }

  private getLastNotificationTime(documentId: string, userId: string): Date | null {
    const docNotifications = this.lastNotificationTimes.get(documentId);
    if (!docNotifications) return null;
    return docNotifications.get(userId) || null;
  }

  private setLastNotificationTime(documentId: string, userId: string, time: Date): void {
    if (!this.lastNotificationTimes.has(documentId)) {
      this.lastNotificationTimes.set(documentId, new Map());
    }
    this.lastNotificationTimes.get(documentId)!.set(userId, time);
  }
}
