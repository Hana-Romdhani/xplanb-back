import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createContentDTO } from './dto/create-content-dto';
import { Content } from './content.schema';
import { Model } from 'mongoose';

@Injectable()
export class ContentRepository {
  constructor(@InjectModel(Content.name) private contentModel: Model<Content>) {}

  async create(contentvalidation: createContentDTO): Promise<Content> {
    try {
      console.log(
        `🔍 Backend Repository: Saving content for document ${contentvalidation.documentId}`
      );
      console.log(
        `🔍 Backend Repository: Content to save - Length: ${contentvalidation.content?.length}, Type: ${typeof contentvalidation.content}`
      );
      console.log(
        `🔍 Backend Repository: Content preview: ${contentvalidation.content?.substring(0, 200)}...`
      );

      // Check if multiple content entries exist (cleanup duplicates)
      const allContents = await this.contentModel
        .find({
          documentId: contentvalidation.documentId
        })
        .sort({ updatedDate: -1, _id: -1 })
        .exec();

      if (allContents.length > 1) {
        console.log(
          `⚠️ Found ${allContents.length} content entries for document ${contentvalidation.documentId}, cleaning up duplicates...`
        );
        // Keep the most recent one, delete the rest
        const toKeep = allContents[0];
        const toDelete = allContents.slice(1);
        const deleteIds = toDelete.map((c) => c._id);
        await this.contentModel.deleteMany({ _id: { $in: deleteIds } }).exec();
        console.log(
          `✅ Deleted ${toDelete.length} duplicate content entries, keeping: ${toKeep._id}`
        );
      }

      // Check if content exists
      const existingContent = await this.contentModel
        .findOne({
          documentId: contentvalidation.documentId
        })
        .exec();

      // Use findOneAndUpdate with upsert to update or create in one operation
      // Use $set for fields that should always be updated, $setOnInsert for fields only set on creation
      const result = await this.contentModel
        .findOneAndUpdate(
          { documentId: contentvalidation.documentId },
          {
            $set: {
              documentId: contentvalidation.documentId,
              content: contentvalidation.content,
              updatedDate: new Date() // Always update the updatedDate
            },
            $setOnInsert: {
              creationDate: new Date()
            }
          },
          {
            upsert: true,
            new: true, // Return the updated document
            runValidators: true
          }
        )
        .exec();

      console.log(
        `✅ Content ${existingContent ? 'updated' : 'created'} for document ${contentvalidation.documentId}`
      );
      console.log(
        `📝 Content saved - Length: ${contentvalidation.content?.length}, DocumentId: ${contentvalidation.documentId}`
      );
      console.log(
        `🔍 Backend Repository: Saved result - ID: ${result._id}, Has content: ${!!result.content}, Content length: ${result.content?.length || 0}`
      );

      // Verify the content was actually saved
      if (!result.content || result.content.length === 0) {
        console.error(`❌ Backend Repository: WARNING - Content field is empty after save!`, {
          id: result._id,
          documentId: result.documentId,
          savedContentLength: contentvalidation.content?.length
        });
      } else {
        // Verify the saved content matches what we tried to save
        const savedContentStr = result.content;
        const expectedContentStr = contentvalidation.content;
        if (savedContentStr !== expectedContentStr) {
          console.error(
            `❌ Backend Repository: WARNING - Saved content doesn't match expected content!`,
            {
              savedLength: savedContentStr.length,
              expectedLength: expectedContentStr.length,
              savedPreview: savedContentStr.substring(0, 100),
              expectedPreview: expectedContentStr.substring(0, 100)
            }
          );
        } else {
          console.log(
            `✅ Backend Repository: Content verified - saved content matches expected content`
          );
        }
      }

      return result;
    } catch (error) {
      console.error('❌ Error saving content:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        documentId: contentvalidation.documentId,
        contentLength: contentvalidation.content?.length
      });

      // If it's a duplicate key error, try to update the existing entry
      if (error.code === 11000 || error.message?.includes('duplicate key')) {
        console.log(`🔄 Duplicate key error detected, attempting to update existing entry...`);
        try {
          const result = await this.contentModel
            .findOneAndUpdate(
              { documentId: contentvalidation.documentId },
              {
                $set: {
                  content: contentvalidation.content,
                  updatedDate: new Date()
                }
              },
              { new: true, runValidators: true }
            )
            .exec();

          if (result) {
            console.log(`✅ Successfully updated existing content entry`);
            return result;
          }
        } catch (updateError) {
          console.error('❌ Failed to update existing entry:', updateError);
        }
      }

      throw error;
    }
  }
  async findLast(id: string): Promise<Content> {
    const filter = { documentId: id };
    // Sort by updatedDate first (most recent), then by _id as fallback
    const defaultOptions = { sort: { updatedDate: -1, _id: -1 } };
    return this.contentModel.findOne(filter, null, defaultOptions).exec();
  }

  async findAll() {
    const contents = await this.contentModel.find().exec();
    return contents;
  }
  async getDocumentId(contentId: string): Promise<string | null> {
    const content = await this.contentModel.findById(contentId).exec();
    if (content) {
      return content.documentId;
    }
    return null;
  }
  async findByDocumentId(documentId: string): Promise<Content | null> {
    const filter = { documentId };
    // Sort by updatedDate first (most recent), then by _id as fallback (ObjectId contains timestamp)
    const defaultOptions = { sort: { updatedDate: -1, _id: -1 } };

    console.log(`🔍 Backend Repository: Searching for content with documentId: ${documentId}`);
    console.log(`🔍 Backend Repository: Filter:`, filter);

    // Debug: Log all content entries for this document
    const allContents = await this.contentModel
      .find(filter)
      .sort({ updatedDate: -1, _id: -1 })
      .exec();
    console.log(
      `🔍 Backend Repository: Found ${allContents.length} content entries for document ${documentId}`
    );
    allContents.forEach((content, index) => {
      console.log(`🔍 Backend Repository: Content ${index + 1}:`, {
        id: content._id,
        documentId: content.documentId,
        creationDate: content.creationDate,
        updatedDate: content.updatedDate,
        hasContent: !!content.content,
        contentLength: content.content?.length || 0,
        contentPreview: content.content ? content.content.substring(0, 100) + '...' : 'NO CONTENT'
      });
    });

    const result = await this.contentModel.findOne(filter, null, defaultOptions).exec();
    console.log(
      `🔍 Backend Repository: Query result:`,
      result
        ? {
            id: result._id,
            documentId: result.documentId,
            creationDate: result.creationDate,
            updatedDate: result.updatedDate,
            hasContent: !!result.content,
            contentLength: result.content?.length || 0,
            contentPreview: result.content ? result.content.substring(0, 100) + '...' : 'NO CONTENT'
          }
        : 'null'
    );

    if (result && !result.content) {
      console.error(`❌ Backend Repository: Content document found but content field is empty!`, {
        id: result._id,
        documentId: result.documentId
      });
    }

    return result;
  }
}
