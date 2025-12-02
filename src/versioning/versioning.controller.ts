/**
 * Versioning Controller
 *
 * Controller pour les endpoints de gestion des versions de documents
 *
 * Emplacement: src/versioning/versioning.controller.ts
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VersioningService } from './versioning.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class VersioningController {
  constructor(private readonly versioningService: VersioningService) {}

  /**
   * Lister toutes les versions d'un document
   * GET /documents/:id/versions
   */
  @Get(':id/versions')
  async getDocumentVersions(@Param('id') documentId: string) {
    return this.versioningService.getDocumentVersions(documentId);
  }

  /**
   * Récupérer une version spécifique
   * GET /documents/:id/versions/:versionId
   */
  @Get(':id/versions/:versionId')
  async getVersion(@Param('id') documentId: string, @Param('versionId') versionId: string) {
    return this.versioningService.getVersion(versionId);
  }

  /**
   * Restaurer une version antérieure
   * POST /documents/:id/versions/:versionId/restore
   */
  @Post(':id/versions/:versionId/restore')
  @HttpCode(HttpStatus.OK)
  async restoreVersion(
    @Param('id') documentId: string,
    @Param('versionId') versionId: string,
    @Request() req: any
  ) {
    const restoredBy = req.user.id;
    return this.versioningService.restoreVersion(documentId, versionId, restoredBy);
  }

  /**
   * Créer une nouvelle version manuellement
   * POST /documents/:id/versions
   */
  @Post(':id/versions')
  async createVersion(
    @Param('id') documentId: string,
    @Body() body: { content: any; description?: string },
    @Request() req: any
  ) {
    const createdBy = req.user.id;
    return this.versioningService.createVersion(
      documentId,
      body.content,
      createdBy,
      body.description
    );
  }

  /**
   * Supprimer une version
   * DELETE /documents/:id/versions/:versionId
   */
  @Post(':id/versions/:versionId/delete')
  @HttpCode(HttpStatus.OK)
  async deleteVersion(
    @Param('id') documentId: string,
    @Param('versionId') versionId: string,
    @Request() req: any
  ) {
    const deletedBy = req.user.id;
    return this.versioningService.deleteVersion(versionId, deletedBy);
  }
}
