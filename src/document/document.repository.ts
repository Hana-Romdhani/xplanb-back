import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Documents } from './document.schema';
import { createDocumentsDTOlayer } from './dto/create-document.dto';
import { Folder } from 'src/folder/folder.schema';
import { Content } from 'src/content/content.schema';

@Injectable()
export class DocumentsRepository {
  constructor(
    @InjectModel(Documents.name) private DocumentsModel: Model<Documents>,
    @InjectModel(Folder.name) private FolderModel: Model<Folder>,
    @InjectModel(Content.name) private ContentModel: Model<Content>
  ) {}

  //Simple Create of documents - DEPRECATED: All documents must have a folder
  // Use createWithFolderId instead
  async create(
    documentsvalidationlayer: createDocumentsDTOlayer,
    userId?: string
  ): Promise<Documents> {
    // All documents must have a folderId now
    if (!documentsvalidationlayer.folderId) {
      throw new Error('folderId is required. All documents must belong to a folder.');
    }

    // Convert contentType to array if it's a string
    const processedData = {
      ...documentsvalidationlayer,
      contentType: Array.isArray(documentsvalidationlayer.contentType)
        ? documentsvalidationlayer.contentType
        : documentsvalidationlayer.contentType
          ? [documentsvalidationlayer.contentType]
          : [],
      createdBy: userId,
      lastEditedBy: userId
    };

    const createDocuments = new this.DocumentsModel(processedData);

    const savedDocuments = await createDocuments.save();

    // Add document to folder's documents array
    const folder = await this.FolderModel.findById(documentsvalidationlayer.folderId);
    if (folder) {
      await folder.updateOne({
        $push: {
          documents: savedDocuments.id
        }
      });
      await folder.save();
    }

    await this.ContentModel.create({
      documentId: savedDocuments._id,
      content:
        '{"time":' +
        Date.now() +
        ',"blocks":[{"id":"' +
        Date.now() +
        '","type":"header","data":{"text":"This is my awesome editor!","level":1}}],"version":"2.29.0"}',
      creationDate: new Date()
    });

    // Populate folderId before returning
    return this.DocumentsModel.findById(savedDocuments._id)
      .populate('createdBy', '_id firstName lastName email')
      .populate('sharedWith', '_id firstName lastName email')
      .populate('folderId', '_id Name user createdDate')
      .exec();
  }
  async createWithFolderId(
    folderId: string,
    documentsValidationLayer: createDocumentsDTOlayer,
    userId?: string
  ): Promise<Documents> {
    // Convert contentType to array if it's a string
    const processedData = {
      ...documentsValidationLayer,
      folderId: folderId,
      contentType: Array.isArray(documentsValidationLayer.contentType)
        ? documentsValidationLayer.contentType
        : documentsValidationLayer.contentType
          ? [documentsValidationLayer.contentType]
          : [],
      createdBy: userId,
      lastEditedBy: userId
    };

    const createDocuments = new this.DocumentsModel(processedData);
    const folder = await this.FolderModel.findById(folderId);

    if (!folder) {
      throw new Error('Folder not found');
    }

    const savedDocuments = await createDocuments.save();

    await this.ContentModel.create({
      documentId: savedDocuments._id,
      content:
        '{"time":' +
        Date.now() +
        ',"blocks":[{"id":"' +
        Date.now() +
        '","type":"header","data":{"text":"This is my awesome editor!","level":1}}],"version":"2.29.0"}',
      creationDate: new Date()
    });
    await folder.updateOne({
      $push: {
        documents: savedDocuments.id
      }
    });
    await folder.save();

    // Populate folderId before returning
    return this.DocumentsModel.findById(savedDocuments._id)
      .populate('createdBy', '_id firstName lastName email')
      .populate('sharedWith', '_id firstName lastName email')
      .populate('folderId', '_id Name user createdDate')
      .exec();
  }

  async findAll(userId?: string): Promise<Documents[]> {
    if (!userId) {
      // If no userId, return empty array (should not happen with auth guard)
      return [];
    }

    // Return documents where:
    // 1. User is the creator (createdBy === userId) OR
    // 2. User is in sharedWith array OR
    // 3. Document is in a folder that user has access to (handled separately)
    // AND document is not archived
    return this.DocumentsModel.find({
      archived: false,
      $or: [{ createdBy: userId }, { sharedWith: userId }]
    })
      .populate('createdBy', '_id firstName lastName email')
      .populate('sharedWith', '_id firstName lastName email')
      .populate('folderId', '_id Name user')
      .exec();
  }
  // findAlldocumentsbyfolder
  async findByFolderId(folderId: string): Promise<Documents[]> {
    return this.DocumentsModel.find({ folderId })
      .populate('createdBy', '_id firstName lastName email')
      .populate('sharedWith', '_id firstName lastName email')
      .populate('folderId', '_id Name user')
      .exec();
  }

  async findOne(id: string): Promise<Documents> {
    return this.DocumentsModel.findById(id)
      .populate('createdBy', '_id firstName lastName email')
      .populate('sharedWith', '_id firstName lastName email')
      .populate('folderId', '_id Name user createdDate')
      .exec();
  }

  async update(id: string, updateFolderDto: any) {
    try {
      console.log(`🔍 Backend Repository: Updating document ${id} with data:`, {
        keys: Object.keys(updateFolderDto),
        hasFolderId: !!updateFolderDto.folderId,
        hasTitle: !!updateFolderDto.Title,
        hasContentType: !!updateFolderDto.contentType
      });

      // If folderId is being changed, update the old and new folder's documents arrays
      if (updateFolderDto.folderId) {
        const oldDoc = await this.DocumentsModel.findById(id).exec();
        if (oldDoc && oldDoc.folderId) {
          // Extract folderId string safely - handle both populated and non-populated
          let oldFolderId: string | null = null;
          if (typeof oldDoc.folderId === 'string') {
            oldFolderId = oldDoc.folderId;
          } else if (
            oldDoc.folderId &&
            typeof oldDoc.folderId === 'object' &&
            oldDoc.folderId._id
          ) {
            oldFolderId = oldDoc.folderId._id.toString();
          } else if (oldDoc.folderId && typeof oldDoc.folderId === 'object') {
            oldFolderId = oldDoc.folderId.toString();
          }

          if (oldFolderId && oldFolderId !== updateFolderDto.folderId) {
            // Remove from old folder
            await this.FolderModel.findByIdAndUpdate(oldFolderId, {
              $pull: { documents: id }
            });

            // Add to new folder
            await this.FolderModel.findByIdAndUpdate(updateFolderDto.folderId, {
              $addToSet: { documents: id }
            });
          }
        }
      }

      // Update updatedDate if not provided
      if (!updateFolderDto.updatedDate) {
        updateFolderDto.updatedDate = new Date();
      }

      const result = await this.DocumentsModel.findByIdAndUpdate(id, updateFolderDto, {
        new: true,
        runValidators: true
      })
        .populate('createdBy', '_id firstName lastName email')
        .populate('sharedWith', '_id firstName lastName email')
        .populate('folderId', '_id Name user createdDate')
        .exec();

      if (!result) {
        throw new NotFoundException(`Document with ID ${id} not found`);
      }

      console.log(`✅ Backend Repository: Document updated successfully:`, {
        id: result._id,
        title: result.Title,
        folderId: result.folderId
      });

      return result;
    } catch (error) {
      console.error(`❌ Backend Repository: Error updating document ${id}:`, error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        updateData: updateFolderDto
      });
      throw error;
    }
  }

  async remove(id: string): Promise<Documents> {
    return this.DocumentsModel.findByIdAndDelete(id).exec();
  }

  async archivePost(id: string): Promise<Documents> {
    const post = await this.DocumentsModel.findById(id)
      .populate('createdBy', '_id firstName lastName email')
      .populate('sharedWith', '_id firstName lastName email')
      .populate('folderId', '_id Name user createdDate')
      .exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    post.archived = true;
    const saved = await post.save();
    // Repopulate after save
    return this.DocumentsModel.findById(saved._id)
      .populate('createdBy', '_id firstName lastName email')
      .populate('sharedWith', '_id firstName lastName email')
      .populate('folderId', '_id Name user createdDate')
      .exec();
  }
  async archivede(id: string): Promise<Documents> {
    const post = await this.DocumentsModel.findById(id)
      .populate('createdBy', '_id firstName lastName email')
      .populate('sharedWith', '_id firstName lastName email')
      .populate('folderId', '_id Name user createdDate')
      .exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    post.archived = false;
    const saved = await post.save();
    // Repopulate after save
    return this.DocumentsModel.findById(saved._id)
      .populate('createdBy', '_id firstName lastName email')
      .populate('sharedWith', '_id firstName lastName email')
      .populate('folderId', '_id Name user createdDate')
      .exec();
  }

  async findFavoriteDocuments(userId: string): Promise<Documents[]> {
    return this.DocumentsModel.find({
      favoritedBy: userId,
      archived: false
    })
      .populate('createdBy', '_id firstName lastName email')
      .populate('sharedWith', '_id firstName lastName email')
      .populate('folderId', '_id Name user')
      .sort({ updatedDate: -1 })
      .exec();
  }
}
