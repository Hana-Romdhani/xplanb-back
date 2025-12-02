/**
 * Shares Controller
 *
 * Controller pour les endpoints de gestion des partages
 *
 * Emplacement: src/shares/shares.controller.ts
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SharesService } from './shares.service';

@Controller('shares')
@UseGuards(JwtAuthGuard)
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  /**
   * Générer un lien de partage
   * POST /shares/generate
   */
  @Post('generate')
  async generateShare(
    @Body()
    body: {
      resourceType: 'document' | 'folder';
      resourceId: string;
      role?: 'view' | 'comment' | 'edit';
      expiresAt?: string;
      isPublic?: boolean;
      password?: string;
    },
    @Request() req: any
  ) {
    const createdBy = req.user.id;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;

    return this.sharesService.generateShare(body.resourceType, body.resourceId, createdBy, {
      role: body.role,
      expiresAt,
      isPublic: body.isPublic,
      password: body.password
    });
  }

  /**
   * Inviter un utilisateur par email
   * POST /shares/invite
   */
  @Post('invite')
  async inviteUser(
    @Body()
    body: {
      shareId: string;
      email: string;
      role: 'view' | 'comment' | 'edit';
    },
    @Request() req: any
  ) {
    const invitedBy = req.user.id;
    return this.sharesService.inviteUser(body.shareId, body.email, body.role, invitedBy);
  }

  /**
   * Modifier le rôle d'un partage
   * PATCH /shares/:id/role
   */
  @Patch(':id/role')
  async updateShareRole(
    @Param('id') shareId: string,
    @Body() body: { role: 'view' | 'comment' | 'edit' },
    @Request() req: any
  ) {
    const updatedBy = req.user.id;
    return this.sharesService.updateShareRole(shareId, body.role, updatedBy);
  }

  /**
   * Révocation d'un partage
   * DELETE /shares/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async revokeShare(@Param('id') shareId: string, @Request() req: any) {
    const revokedBy = req.user.id;
    return this.sharesService.revokeShare(shareId, revokedBy);
  }

  /**
   * Lister les partages d'une ressource
   * GET /shares/resource/:resourceId
   */
  @Get('resource/:resourceId')
  async getResourceShares(@Param('resourceId') resourceId: string) {
    return this.sharesService.getResourceShares(resourceId);
  }

  /**
   * Valider l'accès via token (endpoint public)
   * GET /shares/access/:token
   */
  @Get('access/:token')
  async validateShareAccess(
    @Param('token') token: string,
    @Body() body: { password?: string } = {}
  ) {
    return this.sharesService.validateShareAccess(token, body.password);
  }
}
