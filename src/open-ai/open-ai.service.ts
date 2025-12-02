import { Injectable } from '@nestjs/common';
import { Groq } from 'groq-sdk';
import { DocumentService } from '../document/document.service';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from '../users/users.schema';
import { Content } from '../content/content.schema';

interface DocumentContext {
  documents?: Array<{
    _id: string;
    Title: string;
    folderName?: string;
    createdBy?: { firstName?: string; lastName?: string; email?: string };
    lastEditedBy?: { firstName?: string; lastName?: string; email?: string };
    createdDate?: string;
    updatedDate?: string;
    contentType?: string[];
    content?: any;
  }>;
  folders?: Array<{
    _id: string;
    Name: string;
    documentCount?: number;
  }>;
}

@Injectable()
export class OpenAiService {
  private groq: Groq | null = null;
  apiKey = process.env.OPENAI_API_KEY;

  constructor(
    private documentService: DocumentService,
    @InjectModel('User') private userModel: Model<User>,
    @InjectModel('Content') private contentModel: Model<Content>
  ) {
    if (this.apiKey) {
      this.groq = new Groq({ apiKey: this.apiKey });
    } else {
      console.warn('OPENAI_API_KEY is not defined. AI Assistant will not function properly.');
    }
  }

  async askQuestion(
    question: string,
    userId?: string,
    documentContext?: DocumentContext
  ): Promise<string> {
    try {
      if (!question || question.trim().length === 0) {
        return 'Please provide a valid question.';
      }

      if (!this.groq || !this.apiKey) {
        return 'AI Assistant is not configured. Please set OPENAI_API_KEY in your environment variables.';
      }

      console.log('API Key:', this.apiKey ? 'Present' : 'Missing');
      console.log('Question:', question);
      console.log('User ID:', userId);
      console.log('Document Context:', documentContext ? 'Provided' : 'Not provided');

      // Build system prompt with document context
      const systemPrompt = `You are an AI assistant helping users manage and analyze their documents. 
You have access to document information including titles, folders, creation dates, last edited dates, and content.
You can help users:
- Summarize documents
- Find information in documents
- Answer questions about document metadata (who created it, when it was last edited, etc.)
- Analyze document content
- Provide insights about their document collection

Be helpful, concise, and accurate. If you don't have enough information, say so.`;

      // Add document context to the prompt
      let contextInfo = '';
      if (documentContext) {
        if (documentContext.documents && documentContext.documents.length > 0) {
          contextInfo += '\n\nAvailable Documents:\n';
          documentContext.documents.forEach((doc, index) => {
            contextInfo += `${index + 1}. "${doc.Title}"`;
            if (doc.folderName) {
              contextInfo += ` (Folder: ${doc.folderName})`;
            }
            if (doc.createdBy) {
              const creatorName =
                `${doc.createdBy.firstName || ''} ${doc.createdBy.lastName || ''}`.trim() ||
                doc.createdBy.email;
              contextInfo += `\n   Created by: ${creatorName}`;
            }
            if (doc.lastEditedBy) {
              const editorName =
                `${doc.lastEditedBy.firstName || ''} ${doc.lastEditedBy.lastName || ''}`.trim() ||
                doc.lastEditedBy.email;
              contextInfo += `\n   Last edited by: ${editorName}`;
            }
            if (doc.updatedDate) {
              contextInfo += `\n   Last updated: ${new Date(doc.updatedDate).toLocaleDateString()}`;
            }
            if (doc.contentType && doc.contentType.length > 0) {
              contextInfo += `\n   Tags: ${doc.contentType.join(', ')}`;
            }
            if (doc.content) {
              // Extract text from Editor.js content
              try {
                const contentData =
                  typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
                if (contentData.blocks && Array.isArray(contentData.blocks)) {
                  const textBlocks = contentData.blocks
                    .map((block: any) => {
                      if (block.type === 'paragraph' && block.data?.text) {
                        return block.data.text;
                      } else if (block.type === 'header' && block.data?.text) {
                        return block.data.text;
                      } else if (block.type === 'list' && block.data?.items) {
                        return block.data.items.join('\n');
                      }
                      return null;
                    })
                    .filter(Boolean)
                    .join('\n');
                  if (textBlocks) {
                    contextInfo += `\n   Content preview: ${textBlocks.substring(0, 500)}${textBlocks.length > 500 ? '...' : ''}`;
                  }
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
            contextInfo += '\n';
          });
        }

        if (documentContext.folders && documentContext.folders.length > 0) {
          contextInfo += '\n\nAvailable Folders:\n';
          documentContext.folders.forEach((folder, index) => {
            contextInfo += `${index + 1}. "${folder.Name}"`;
            if (folder.documentCount !== undefined) {
              contextInfo += ` (${folder.documentCount} document${folder.documentCount !== 1 ? 's' : ''})`;
            }
            contextInfo += '\n';
          });
        }
      }

      const userMessage = contextInfo
        ? `${contextInfo}\n\nUser Question: ${question.trim()}`
        : question.trim();

      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        model: 'llama-3.1-8b-instant',
        temperature: 0.7,
        max_tokens: 2000
      });

      return completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
    } catch (error) {
      console.error('Groq API error:', error);
      return 'Sorry, I encountered an error while processing your request. Please try again.';
    }
  }
}
