/**
 * Shares Service
 *
 * Service pour la gestion des partages de documents et dossiers
 * Support pour les liens publics avec expiration et les invitations par email
 *
 * Emplacement: src/shares/shares.service.ts
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Share, ShareDocument } from './shares.schema';
import { Documents, DocumentsDocument } from '../document/document.schema';
import { Folder, FolderDocument } from '../folder/folder.schema';
import { User, UserDocument } from '../users/users.schema';
import { DocumentService } from '../document/document.service';

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor(
    @InjectModel(Share.name) private shareModel: Model<ShareDocument>,
    @InjectModel(Documents.name) private documentsModel: Model<DocumentsDocument>,
    @InjectModel(Folder.name) private folderModel: Model<FolderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly documentService: DocumentService
  ) {}

  /**
   * Générer un lien de partage
   */
  async generateShare(
    resourceType: 'document' | 'folder',
    resourceId: string,
    createdBy: string,
    options: {
      role?: 'view' | 'comment' | 'edit';
      expiresAt?: Date;
      isPublic?: boolean;
      password?: string;
    } = {}
  ): Promise<Share> {
    try {
      // Vérifier que la ressource existe
      const resource = await this.getResource(resourceType, resourceId);
      if (!resource) {
        throw new NotFoundException(`${resourceType} not found`);
      }

      // Vérifier les permissions du créateur
      const hasPermission = await this.checkResourcePermission(resourceType, resourceId, createdBy);
      if (!hasPermission) {
        throw new BadRequestException('Insufficient permissions to share this resource');
      }

      // Générer un token unique
      const token = uuidv4();

      // Créer le partage
      const share = new this.shareModel({
        token,
        resourceType,
        resourceId,
        createdBy,
        role: options.role || 'view',
        expiresAt: options.expiresAt,
        isPublic: options.isPublic || false,
        password: options.password
      });

      const savedShare = await share.save();
      this.logger.log(`Share created for ${resourceType} ${resourceId} with token ${token}`);

      return savedShare;
    } catch (error) {
      this.logger.error(`Error generating share: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inviter un utilisateur par email
   */
  async inviteUser(
    shareId: string,
    email: string,
    role: 'view' | 'comment' | 'edit',
    invitedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const share = await this.shareModel.findById(shareId);
      if (!share) {
        throw new NotFoundException('Share not found');
      }

      // Vérifier que l'inviteur a les permissions
      if (share.createdBy.toString() !== invitedBy) {
        throw new BadRequestException('Insufficient permissions');
      }

      // Trouver l'utilisateur par email
      const user = await this.userModel.findOne({ email });
      if (!user) {
        return {
          success: false,
          message: 'User not found with this email address'
        };
      }

      // Créer un partage spécifique pour cet utilisateur
      const userShare = new this.shareModel({
        token: uuidv4(),
        resourceType: share.resourceType,
        resourceId: share.resourceId,
        createdBy: invitedBy,
        sharedWith: user._id,
        role,
        expiresAt: share.expiresAt,
        isPublic: false
      });

      await userShare.save();

      // Ajouter l'utilisateur à la ressource partagée
      await this.addUserToResource(
        share.resourceType,
        share.resourceId.toString(),
        user._id.toString()
      );

      this.logger.log(`User ${email} invited to ${share.resourceType} ${share.resourceId}`);

      return {
        success: true,
        message: 'User invited successfully'
      };
    } catch (error) {
      this.logger.error(`Error inviting user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Modifier le rôle d'un partage
   */
  async updateShareRole(
    shareId: string,
    newRole: 'view' | 'comment' | 'edit',
    updatedBy: string
  ): Promise<Share> {
    try {
      const share = await this.shareModel.findById(shareId);
      if (!share) {
        throw new NotFoundException('Share not found');
      }

      // Vérifier les permissions
      if (share.createdBy.toString() !== updatedBy) {
        throw new BadRequestException('Insufficient permissions');
      }

      share.role = newRole;
      const updatedShare = await share.save();

      this.logger.log(`Share ${shareId} role updated to ${newRole}`);
      return updatedShare;
    } catch (error) {
      this.logger.error(`Error updating share role: ${error.message}`);
      throw error;
    }
  }

  /**
   * Révocation d'un partage
   */
  async revokeShare(shareId: string, revokedBy: string): Promise<boolean> {
    try {
      const share = await this.shareModel.findById(shareId);
      if (!share) {
        throw new NotFoundException('Share not found');
      }

      // Vérifier les permissions
      if (share.createdBy.toString() !== revokedBy) {
        throw new BadRequestException('Insufficient permissions');
      }

      await this.shareModel.findByIdAndDelete(shareId);

      this.logger.log(`Share ${shareId} revoked`);
      return true;
    } catch (error) {
      this.logger.error(`Error revoking share: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lister les partages d'une ressource
   */
  async getResourceShares(resourceId: string): Promise<Share[]> {
    try {
      const shares = await this.shareModel
        .find({ resourceId })
        .populate('createdBy', 'firstName lastName email')
        .populate('sharedWith', 'firstName lastName email')
        .exec();

      return shares;
    } catch (error) {
      this.logger.error(`Error getting resource shares: ${error.message}`);
      throw error;
    }
  }

  /**
   * Valider l'accès via token
   */
  async validateShareAccess(
    token: string,
    password?: string
  ): Promise<{ share: Share; resource: any } | null> {
    try {
      const share = await this.shareModel.findOne({ token });
      if (!share) {
        return null;
      }

      // Vérifier l'expiration
      if (share.expiresAt && share.expiresAt < new Date()) {
        this.logger.warn(`Share ${token} has expired`);
        return null;
      }

      // Vérifier le mot de passe pour les liens publics
      if (share.isPublic && share.password && share.password !== password) {
        return null;
      }

      // Récupérer la ressource
      const resource = await this.getResource(share.resourceType, share.resourceId.toString());
      if (!resource) {
        return null;
      }

      // Mettre à jour les statistiques d'accès
      await this.shareModel.findByIdAndUpdate(share._id, {
        $inc: { accessCount: 1 },
        $set: { lastAccessedAt: new Date() }
      });

      return { share, resource };
    } catch (error) {
      this.logger.error(`Error validating share access: ${error.message}`);
      return null;
    }
  }

  /**
   * Récupérer une ressource par type et ID
   */
  private async getResource(resourceType: string, resourceId: string): Promise<any> {
    if (resourceType === 'document') {
      return this.documentsModel.findById(resourceId);
    } else if (resourceType === 'folder') {
      return this.folderModel.findById(resourceId);
    }
    return null;
  }

  /**
   * Vérifier les permissions sur une ressource
   */
  private async checkResourcePermission(
    resourceType: string,
    resourceId: string,
    userId: string
  ): Promise<boolean> {
    if (resourceType === 'document') {
      const document = await this.documentsModel.findById(resourceId);
      return (
        document &&
        (document.createdBy?.toString() === userId ||
          document.sharedWith?.some((id) => id.toString() === userId))
      );
    } else if (resourceType === 'folder') {
      const folder = await this.folderModel.findById(resourceId);
      return (
        folder &&
        (folder.user?.toString() === userId ||
          folder.sharedWith?.some((id) => id.toString() === userId))
      );
    }
    return false;
  }

  /**
   * Ajouter un utilisateur à une ressource
   */
  private async addUserToResource(
    resourceType: string,
    resourceId: string,
    userId: string
  ): Promise<void> {
    if (resourceType === 'document') {
      await this.documentsModel.findByIdAndUpdate(resourceId, {
        $addToSet: { sharedWith: userId }
      });

      // Track share count
      await this.documentService.trackShare(resourceId);
    } else if (resourceType === 'folder') {
      await this.folderModel.findByIdAndUpdate(resourceId, {
        $addToSet: { sharedWith: userId }
      });
    }
  }
}
