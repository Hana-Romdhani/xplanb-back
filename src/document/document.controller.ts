import { Documents } from './document.schema';
import { createDocumentsDTOlayer } from './dto/create-document.dto';
import { updateDocumentsDTOlayer } from './dto/update-document.dto';
import { DocumentService } from './document.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  Request,
  Res
} from '@nestjs/common';
import { Folder } from 'src/folder/folder.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Response } from 'express';
@Controller('Document')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly DocService: DocumentService) {}

  @Post('/dearchive/:id')
  async archivedea(@Param('id') id: string) {
    return this.DocService.archivede(id);
  }

  @Get()
  async findAll(@Request() req): Promise<Documents[]> {
    const userId = req.user.id || req.user._id;
    return this.DocService.findAll(userId);
  }

  @Get('/documents/:folderId')
  async findAllDoumentByFolderId(
    @Param('folderId') folderId: string,
    @Request() req
  ): Promise<Documents[]> {
    const userId = req.user.id;
    return this.DocService.findByFolderId(folderId, userId);
  }

  /**
   * Get favorite documents for current user
   * GET /Document/favorites
   */
  @Get('favorites')
  async getFavoriteDocuments(@Request() req: any): Promise<Documents[]> {
    const userId = req.user.id || req.user._id;
    return this.DocService.getFavoriteDocuments(userId);
  }

  /**
   * Get user's access level for a document
   * GET /Document/:id/access
   * MUST come before @Get(':id') to avoid route conflicts
   */
  @Get(':id/access')
  async getAccessLevel(@Param('id') id: string, @Request() req: any): Promise<string> {
    try {
      const userId = req.user.id;
      console.log('🔍 Getting access level for document:', id, 'user:', userId);
      const accessLevel = await this.DocService.getUserAccessLevel(id, userId);
      console.log('✅ Access level:', accessLevel);
      return accessLevel;
    } catch (error) {
      console.error('❌ Error getting access level:', error);
      throw error;
    }
  }

  /**
   * Get shared users for a document
   * GET /Document/:id/shared-users
   * MUST come before @Get(':id') to avoid route conflicts
   */
  @Get(':id/shared-users')
  async getSharedUsers(@Param('id') id: string): Promise<any[]> {
    return this.DocService.getSharedUsers(id);
  }

  /**
   * Get document statistics
   * GET /Document/:id/stats
   * MUST come before @Get(':id') to avoid route conflicts
   */
  @Get(':id/stats')
  async getDocumentStats(@Param('id') id: string): Promise<any> {
    return this.DocService.getDocumentStats(id);
  }

  /**
   * Export document as PDF
   * GET /Document/:id/export/pdf
   * MUST come before @Get(':id') to avoid route conflicts
   */
  @Get(':id/export/pdf')
  async exportPDF(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response
  ): Promise<void> {
    try {
      const userId = req.user.id || req.user._id;
      const pdfBuffer = await this.DocService.generatePDF(id, userId);

      // Get document title for filename
      const document = await this.DocService.findOne(id);
      const filename = `${(document?.Title || 'document').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF buffer
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      res.status(500).json({
        error: error.message || 'Failed to export PDF'
      });
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Documents> {
    return this.DocService.findOne(id);
  }

  @Post()
  async create(
    @Body() Documentsvalidator: createDocumentsDTOlayer,
    @Request() req: any
  ): Promise<Documents> {
    const userId = req.user.id;
    // Documents must be created with a folder - use createWithFolderId
    if (!Documentsvalidator.folderId) {
      throw new Error(
        'folderId is required. Use POST /Document/:folderId to create a document with a folder.'
      );
    }
    return this.DocService.createWithFolderId(
      Documentsvalidator.folderId,
      Documentsvalidator,
      userId
    );
  }
  @Post(':folderId')
  async createDocument(
    @Param('folderId') folderId: string,
    @Body() documentsValidationLayer: Omit<createDocumentsDTOlayer, 'folderId'>,
    @Request() req: any
  ): Promise<Documents> {
    const userId = req.user.id;
    // folderId comes from URL parameter, so we create a new DTO with folderId from URL
    const dtoWithFolderId: createDocumentsDTOlayer = {
      ...documentsValidationLayer,
      folderId: folderId
    } as createDocumentsDTOlayer;
    return this.DocService.createWithFolderId(folderId, dtoWithFolderId, userId);
  }

  @Post('/createavecaffectation/:folderId')
  async createDocumentWithAffectation(
    @Param('folderId') folderId: string,
    @Body() documentsValidationLayer: Omit<createDocumentsDTOlayer, 'folderId'>,
    @Request() req: any
  ): Promise<Documents> {
    const userId = req.user.id;
    // folderId comes from URL parameter, so we create a new DTO with folderId from URL
    const dtoWithFolderId: createDocumentsDTOlayer = {
      ...documentsValidationLayer,
      folderId: folderId
    } as createDocumentsDTOlayer;
    return this.DocService.createWithFolderId(folderId, dtoWithFolderId, userId);
  }
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updatedocuDto: updateDocumentsDTOlayer,
    @Request() req: any
  ): Promise<Documents> {
    const userId = req.user.id;
    return this.DocService.update(id, updatedocuDto, userId);
  }
  @Put('/archive/:id')
  async archivePost(@Param('id') id: string) {
    return this.DocService.archivePost(id);
  }
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Documents> {
    return this.DocService.remove(id);
  }
  @Get('folder/:folderId')
  async getFolderById(@Param('folderId') folderId: string): Promise<Folder | null> {
    return this.DocService.findFolderById(folderId);
  }

  /**
   * Dupliquer un document
   * POST /Document/:id/duplicate
   */
  @Post(':id/duplicate')
  async duplicateDocument(
    @Param('id') id: string,
    @Body() body: { newTitle?: string; targetFolderId?: string },
    @Request() req: any
  ): Promise<Documents> {
    const userId = req.user.id;
    return this.DocService.duplicateDocument(id, userId, body.newTitle, body.targetFolderId);
  }

  /**
   * Mettre à jour le contenu d'un document
   * PATCH /Document/:id/content
   */
  @Patch(':id/content')
  async updateContent(
    @Param('id') id: string,
    @Body() body: { content: any },
    @Request() req: any
  ): Promise<Documents> {
    const userId = req.user.id;
    // Track edit when content is updated
    await this.DocService.trackEdit(id, userId);
    return this.DocService.updateContent(id, body.content, userId);
  }

  /**
   * Track document view
   * POST /Document/:id/view
   */
  @Post(':id/view')
  async trackView(@Param('id') id: string, @Request() req: any): Promise<void> {
    const userId = req.user.id;
    return this.DocService.trackView(id, userId);
  }

  /**
   * Favorite a document
   * POST /Document/:id/favorite
   */
  @Post(':id/favorite')
  async favoriteDocument(@Param('id') id: string, @Request() req: any): Promise<Documents> {
    const userId = req.user.id;
    return this.DocService.favoriteDocument(id, userId);
  }

  /**
   * Unfavorite a document
   * POST /Document/:id/unfavorite
   */
  @Post(':id/unfavorite')
  async unfavoriteDocument(@Param('id') id: string, @Request() req: any): Promise<Documents> {
    const userId = req.user.id;
    return this.DocService.unfavoriteDocument(id, userId);
  }

  /**
   * Share document with a user
   * POST /Document/:id/share
   */
  @Post(':id/share')
  async shareDocument(
    @Param('id') id: string,
    @Body() body: { userId: string; access?: 'view' | 'edit' },
    @Request() req: any
  ): Promise<Documents> {
    const currentUserId = req.user.id;
    // Access is now only 'view' | 'edit' (no 'update')
    const access = body.access || 'view';
    return this.DocService.shareDocument(id, body.userId, access, currentUserId);
  }

  /**
   * Share document by email
   * POST /Document/:id/share-email
   */
  @Post(':id/share-email')
  async shareDocumentByEmail(
    @Param('id') id: string,
    @Body() body: { email: string; access?: 'view' | 'edit' },
    @Request() req: any
  ): Promise<{ success: boolean; message: string }> {
    const currentUserId = req.user.id;
    // Access is now only 'view' | 'edit' (no 'update')
    const access = body.access || 'view';
    return this.DocService.shareDocumentByEmail(id, body.email, access, currentUserId);
  }

  /**
   * Remove user from document sharing
   * DELETE /Document/:id/share/:userId
   */
  @Delete(':id/share/:userId')
  async removeUserFromDocument(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req: any
  ): Promise<Documents> {
    const currentUserId = req.user.id;
    return this.DocService.removeUserFromDocument(id, userId, currentUserId);
  }
}
