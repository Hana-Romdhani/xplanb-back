/**
 * Versioning Service
 *
 * Service pour la gestion des versions de documents
 * Permet de créer, lister et restaurer des versions antérieures
 *
 * Emplacement: src/versioning/versioning.service.ts
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Documents, DocumentsDocument } from '../document/document.schema';
import { DocumentVersion, DocumentVersionDocument } from '../document/document-version.schema';
import { Content, ContentDocument } from '../content/content.schema';

@Injectable()
export class VersioningService {
  private readonly logger = new Logger(VersioningService.name);

  constructor(
    @InjectModel(Documents.name) private documentsModel: Model<DocumentsDocument>,
    @InjectModel(DocumentVersion.name) private documentVersionModel: Model<DocumentVersionDocument>,
    @InjectModel(Content.name) private contentModel: Model<ContentDocument>
  ) {}

  /**
   * Créer une nouvelle version d'un document
   */
  async createVersion(
    documentId: string,
    content: any,
    createdBy: string,
    description?: string
  ): Promise<DocumentVersion> {
    try {
      // Vérifier que le document existe
      const document = await this.documentsModel.findById(documentId);
      if (!document) {
        throw new NotFoundException('Document not found');
      }

      // Ensure content is an object (DocumentVersion schema expects Object type)
      let contentObj = content;
      if (typeof content === 'string') {
        try {
          contentObj = JSON.parse(content);
        } catch (parseError) {
          this.logger.warn(`Error parsing content string: ${parseError.message}`);
          contentObj = {};
        }
      }

      // Créer la nouvelle version
      const version = new this.documentVersionModel({
        documentId,
        version: document.version + 1,
        content: contentObj,
        createdBy,
        description
      });

      const savedVersion = await version.save();

      // Mettre à jour le document avec la nouvelle version
      await this.documentsModel.findByIdAndUpdate(documentId, {
        $inc: { version: 1 },
        $push: { previousVersions: savedVersion._id },
        lastEditedBy: createdBy,
        updatedDate: new Date()
      });

      this.logger.log(`Version ${savedVersion.version} created for document ${documentId}`);
      return savedVersion;
    } catch (error) {
      this.logger.error(`Error creating version: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lister toutes les versions d'un document
   */
  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    try {
      const versions = await this.documentVersionModel
        .find({ documentId })
        .populate('createdBy', 'firstName lastName email')
        .sort({ version: -1 })
        .exec();

      return versions;
    } catch (error) {
      this.logger.error(`Error getting document versions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Récupérer une version spécifique
   */
  async getVersion(versionId: string): Promise<DocumentVersion> {
    try {
      const version = await this.documentVersionModel
        .findById(versionId)
        .populate('createdBy', 'firstName lastName email')
        .exec();

      if (!version) {
        throw new NotFoundException('Version not found');
      }

      return version;
    } catch (error) {
      this.logger.error(`Error getting version: ${error.message}`);
      throw error;
    }
  }

  /**
   * Restaurer une version antérieure
   */
  async restoreVersion(
    documentId: string,
    versionId: string,
    restoredBy: string
  ): Promise<{ success: boolean; newVersion: DocumentVersion; restoredContent: string }> {
    try {
      // Vérifier que le document existe
      const document = await this.documentsModel.findById(documentId);
      if (!document) {
        throw new NotFoundException('Document not found');
      }

      // Récupérer la version à restaurer
      const versionToRestore = await this.documentVersionModel.findById(versionId);
      if (!versionToRestore) {
        throw new NotFoundException('Version not found');
      }

      // Vérifier que la version appartient au document
      if (versionToRestore.documentId.toString() !== documentId) {
        throw new BadRequestException('Version does not belong to this document');
      }

      // Fetch current content from Content collection
      let currentContent = '{}';
      try {
        const contentDoc = await this.contentModel
          .findOne({ documentId })
          .sort({ creationDate: -1 })
          .exec();
        if (contentDoc && contentDoc.content) {
          currentContent = contentDoc.content;
          this.logger.log(
            `Found current content for document ${documentId}, length: ${currentContent.length}`
          );
        } else {
          this.logger.warn(`No content found for document ${documentId}, using empty content`);
        }
      } catch (contentError) {
        this.logger.error(`Error fetching current content: ${contentError.message}`);
        // Continue with empty content as fallback
      }

      // Parse content to object for DocumentVersion schema (which expects Object type)
      let currentContentObj;
      try {
        currentContentObj = JSON.parse(currentContent);
      } catch (parseError) {
        this.logger.warn(
          `Error parsing current content: ${parseError.message}, using empty object`
        );
        currentContentObj = {};
      }

      // Create version from current content BEFORE restoring
      const currentVersion = new this.documentVersionModel({
        documentId,
        version: document.version + 1,
        content: currentContentObj,
        createdBy: restoredBy,
        description: 'Auto-saved before restore'
      });
      await currentVersion.save();

      // Update document metadata
      await this.documentsModel.findByIdAndUpdate(documentId, {
        $inc: { version: 1 },
        $push: { previousVersions: currentVersion._id },
        lastEditedBy: restoredBy,
        updatedDate: new Date()
      });

      // Now restore the content from versionToRestore to the Content collection
      let contentToRestore = versionToRestore.content;

      // Convert content to string if it's an object
      if (typeof contentToRestore === 'object') {
        contentToRestore = JSON.stringify(contentToRestore);
      }

      // Create new content entry with the restored content
      const restoredContent = new this.contentModel({
        documentId,
        content: contentToRestore,
        creationDate: new Date()
      });
      await restoredContent.save();

      this.logger.log(
        `Version ${versionToRestore.version} restored for document ${documentId}, content size: ${contentToRestore.length}`
      );

      return {
        success: true,
        newVersion: currentVersion,
        restoredContent: contentToRestore
      };
    } catch (error) {
      this.logger.error(`Error restoring version: ${error.message}`);
      throw error;
    }
  }

  /**
   * Supprimer une version (soft delete)
   */
  async deleteVersion(versionId: string, deletedBy: string): Promise<boolean> {
    try {
      const version = await this.documentVersionModel.findById(versionId);
      if (!version) {
        throw new NotFoundException('Version not found');
      }

      // Marquer comme supprimé plutôt que de supprimer définitivement
      await this.documentVersionModel.findByIdAndUpdate(versionId, {
        $set: { deletedAt: new Date(), deletedBy }
      });

      this.logger.log(`Version ${versionId} marked as deleted`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting version: ${error.message}`);
      throw error;
    }
  }

  /**
   * Créer une version automatique (pour auto-save)
   */
  async createAutoVersion(
    documentId: string,
    content: any,
    createdBy: string
  ): Promise<DocumentVersion | null> {
    try {
      const document = await this.documentsModel.findById(documentId);
      if (!document) return null;

      // Ensure content is an object (DocumentVersion schema expects Object type)
      let contentObj = content;
      if (typeof content === 'string') {
        try {
          contentObj = JSON.parse(content);
        } catch (parseError) {
          this.logger.warn(`Error parsing content string: ${parseError.message}`);
          contentObj = {};
        }
      }

      // Créer une version automatique
      const version = new this.documentVersionModel({
        documentId,
        version: document.version + 1,
        content: contentObj,
        createdBy,
        description: 'Auto-saved version'
      });

      const savedVersion = await version.save();

      // Mettre à jour le document
      await this.documentsModel.findByIdAndUpdate(documentId, {
        $inc: { version: 1 },
        $push: { previousVersions: savedVersion._id },
        lastEditedBy: createdBy,
        updatedDate: new Date()
      });

      return savedVersion;
    } catch (error) {
      this.logger.error(`Error creating auto version: ${error.message}`);
      return null;
    }
  }

  /**
   * Nettoyer les anciennes versions (garde les 50 dernières)
   */
  async cleanupOldVersions(documentId: string): Promise<number> {
    try {
      const versions = await this.documentVersionModel
        .find({ documentId })
        .sort({ version: -1 })
        .skip(50) // Garder les 50 dernières versions
        .exec();

      const versionIds = versions.map((v) => v._id);

      if (versionIds.length > 0) {
        await this.documentVersionModel.deleteMany({
          _id: { $in: versionIds }
        });

        // Retirer les références du document
        await this.documentsModel.findByIdAndUpdate(documentId, {
          $pull: { previousVersions: { $in: versionIds } }
        });

        this.logger.log(`Cleaned up ${versionIds.length} old versions for document ${documentId}`);
      }

      return versionIds.length;
    } catch (error) {
      this.logger.error(`Error cleaning up versions: ${error.message}`);
      return 0;
    }
  }
}
