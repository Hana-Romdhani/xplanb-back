import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { createContentDTO } from './dto/create-content-dto';
import { ContentService } from './content.service';
import { Content } from './content.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('content')
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post()
  async create(@Body() Contentsvalidator: createContentDTO, @Request() req: any) {
    try {
      const userId = req.user.id;
      console.log('🔍 Backend: Creating/updating content with data:', {
        documentId: Contentsvalidator.documentId,
        userId,
        contentPreview: Contentsvalidator.content?.substring(0, 100) + '...',
        contentLength: Contentsvalidator.content?.length
      });

      if (!Contentsvalidator.documentId) {
        throw new Error('documentId is required');
      }

      if (!Contentsvalidator.content) {
        throw new Error('content is required');
      }

      const result = await this.contentService.createContent(Contentsvalidator, userId);

      console.log('🔍 Backend: Content saved successfully:', {
        id: result._id,
        documentId: result.documentId,
        creationDate: result.creationDate
      });

      return result;
    } catch (error) {
      console.error('❌ Error in content controller:', error);
      throw error;
    }
  }

  @Get('/:id/last')
  async getLastContent(@Param('id') id: string): Promise<Content> {
    return this.contentService.getLastContent(id);
  }
  @Get()
  async getAllContents() {
    return this.contentService.getAllContentst();
  }
  @Get('/:id/documentId')
  async getDocumentId(@Param('id') id: string): Promise<string | null> {
    return this.contentService.getDocumentId(id);
  }
  @Get('document/:documentId')
  async getDocumentById(@Param('documentId') documentId: string): Promise<Content | null> {
    console.log(`🔍 Backend: Getting content for document ${documentId}`);
    const content = await this.contentService.getDocumentById(documentId);
    console.log(
      `🔍 Backend: Content result:`,
      content
        ? {
            id: content._id,
            documentId: content.documentId,
            hasContent: !!content.content,
            contentLength: content.content?.length,
            contentPreview: content.content?.substring(0, 100) + '...'
          }
        : 'null'
    );
    return content;
  }
}
