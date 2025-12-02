import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { OpenAiService } from './open-ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentService } from '../document/document.service';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../users/users.schema';
import { Content } from '../content/content.schema';

@Controller('openai')
@UseGuards(JwtAuthGuard)
export class OpenAiController {
  constructor(
    private readonly openAIService: OpenAiService,
    private readonly documentService: DocumentService,
    @InjectModel('User') private userModel: Model<User>,
    @InjectModel('Content') private contentModel: Model<Content>
  ) {}

  @Post()
  async askQuestion(
    @Body('question') question: string,
    @Body('documentIds') documentIds?: string[],
    @Body('folderIds') folderIds?: string[],
    @Request() req?: any
  ) {
    const userId = req?.user?.id || req?.user?._id;

    // Build document context if documentIds or folderIds are provided
    let documentContext: any = undefined;

    if (documentIds && documentIds.length > 0) {
      try {
        const documents = await Promise.all(
          documentIds.map(async (docId) => {
            try {
              const doc = await this.documentService.findOne(docId);
              if (!doc) return null;

              // Get document content
              const content = await this.contentModel.findOne({ documentId: docId });

              // Get folder name
              let folderName = 'Uncategorized';
              if (doc.folderId) {
                // Handle both populated and non-populated folderId
                let folderId: string | null = null;
                if (typeof doc.folderId === 'string') {
                  folderId = doc.folderId;
                } else if (typeof doc.folderId === 'object') {
                  // Check if it's populated (has Name property) or just an ObjectId
                  if ('Name' in doc.folderId) {
                    folderName = (doc.folderId as any).Name || 'Uncategorized';
                    folderId = (doc.folderId as any)._id?.toString() || null;
                  } else {
                    folderId =
                      (doc.folderId as any)._id?.toString() ||
                      (doc.folderId as any)?.toString() ||
                      null;
                  }
                }

                // If we still need to fetch folder name
                if (folderId && folderName === 'Uncategorized') {
                  try {
                    const folder = await this.documentService.findFolderById(folderId);
                    if (folder) {
                      folderName = folder.Name;
                    }
                  } catch (error) {
                    console.warn(`Failed to fetch folder ${folderId}:`, error);
                  }
                }
              }

              // Get user info for lastEditedBy
              let lastEditedBy = null;
              if (doc.lastEditedBy) {
                const editorId =
                  typeof doc.lastEditedBy === 'string'
                    ? doc.lastEditedBy
                    : (doc.lastEditedBy as any)?._id?.toString() ||
                      (doc.lastEditedBy as any)?.toString();
                if (editorId) {
                  const editor = await this.userModel.findById(editorId);
                  if (editor) {
                    lastEditedBy = {
                      firstName: editor.firstName,
                      lastName: editor.lastName,
                      email: editor.email
                    };
                  }
                }
              }

              // Get createdBy user info (handle both populated and non-populated)
              let createdByInfo = null;
              if (doc.createdBy) {
                if (typeof doc.createdBy === 'object' && 'firstName' in doc.createdBy) {
                  // Already populated
                  createdByInfo = {
                    firstName: (doc.createdBy as any).firstName,
                    lastName: (doc.createdBy as any).lastName,
                    email: (doc.createdBy as any).email
                  };
                } else {
                  // Not populated, fetch user
                  const creatorId =
                    typeof doc.createdBy === 'string'
                      ? doc.createdBy
                      : (doc.createdBy as any)?._id?.toString() ||
                        (doc.createdBy as any)?.toString();
                  if (creatorId) {
                    const creator = await this.userModel.findById(creatorId);
                    if (creator) {
                      createdByInfo = {
                        firstName: creator.firstName,
                        lastName: creator.lastName,
                        email: creator.email
                      };
                    }
                  }
                }
              }

              // Get document ID (handle Mongoose Document type)
              const documentId =
                (doc as any)._id?.toString() || (doc as any).id?.toString() || docId;

              return {
                _id: documentId,
                Title: doc.Title,
                folderName,
                createdBy: createdByInfo,
                lastEditedBy,
                createdDate: doc.createdDate ? new Date(doc.createdDate).toISOString() : undefined,
                updatedDate: doc.updatedDate ? new Date(doc.updatedDate).toISOString() : undefined,
                contentType: doc.contentType || [],
                content: content?.content || null
              };
            } catch (error) {
              console.error(`Error fetching document ${docId}:`, error);
              return null;
            }
          })
        );

        documentContext = {
          documents: documents.filter((doc) => doc !== null)
        };
      } catch (error) {
        console.error('Error building document context:', error);
      }
    }

    if (folderIds && folderIds.length > 0) {
      try {
        const folders = await Promise.all(
          folderIds.map(async (folderId) => {
            try {
              const folder = await this.documentService.findFolderById(folderId);
              if (!folder) return null;

              const docs = await this.documentService.findByFolderId(folderId, userId);

              // Get folder ID (handle Mongoose Document type)
              const folderIdStr =
                (folder as any)._id?.toString() || (folder as any).id?.toString() || folderId;

              return {
                _id: folderIdStr,
                Name: folder.Name,
                documentCount: docs.length
              };
            } catch (error) {
              console.error(`Error fetching folder ${folderId}:`, error);
              return null;
            }
          })
        );

        if (!documentContext) {
          documentContext = {};
        }
        documentContext.folders = folders.filter((folder) => folder !== null);
      } catch (error) {
        console.error('Error building folder context:', error);
      }
    }

    return this.openAIService.askQuestion(question, userId, documentContext);
  }
}
