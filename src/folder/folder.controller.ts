import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { Folder } from './folder.schema';
import { createFolderDTOlayer } from './dto/create-folder.dto';
import { FolderService } from './folder.service';
import { AuthGuard } from '@nestjs/passport/dist/auth.guard';

@Controller('folder')
@UseGuards(AuthGuard('jwt'))
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get('search')
  async search(
    @Req() req,
    @Query('keyword') keyword: string,
    @Query('page') page: number,
    @Query('perPage') perPage: number
  ): Promise<Folder[]> {
    const userId = req.user.id;
    return this.folderService.search(keyword, userId, page, perPage);
  }

  @Get('getAllFolder')
  async findAll(
    @Req() req,
    @Query('page') page: number = 1,
    @Query('perPage') perPage: number = 3
  ): Promise<Folder[]> {
    const userId = req.user.id;
    return this.folderService.findAll(userId, page, perPage);
  }

  @Post('/AddFolder')
  async create(
    @Body() createFolderDto: createFolderDTOlayer,
    @Req() req
  ): Promise<createFolderDTOlayer> {
    console.log(req.user.id);
    return this.folderService.create(createFolderDto, req.user.id);
  }
  @Get('shared')
  async getSharedFolders(@Req() req): Promise<Folder[]> {
    try {
      const userId = req.user.id;
      console.log('User ID:', userId);

      const sharedFolders = await this.folderService.getSharedFoldersForUser(userId);
      console.log('Shared Folders:', sharedFolders);

      return sharedFolders;
    } catch (error) {
      console.error('Error fetching shared folders:', error.message);
      throw error;
    }
  }

  @Get('unshared')
  async getUnsharedFolders(
    @Req() req,
    @Query('page') page: number = 1,
    @Query('perPage') perPage: number = 3
  ): Promise<Folder[]> {
    try {
      const userId = req.user.id;
      console.log('Getting unshared folders for user:', userId);

      const unsharedFolders = await this.folderService.getUnsharedFoldersForUser(
        userId,
        page,
        perPage
      );
      console.log('Unshared Folders:', unsharedFolders);

      return unsharedFolders;
    } catch (error) {
      console.error('Error fetching unshared folders:', error.message);
      throw error;
    }
  }

  @Get('my-shared')
  async getMySharedFolders(
    @Req() req,
    @Query('page') page: number = 1,
    @Query('perPage') perPage: number = 3
  ): Promise<Folder[]> {
    try {
      const userId = req.user.id;
      console.log('Getting my shared folders for user:', userId);

      const mySharedFolders = await this.folderService.getMySharedFoldersForUser(
        userId,
        page,
        perPage
      );
      console.log('My Shared Folders:', mySharedFolders);

      return mySharedFolders;
    } catch (error) {
      console.error('Error fetching my shared folders:', error.message);
      throw error;
    }
  }

  @Get('search/unshared')
  async searchUnsharedFolders(
    @Req() req,
    @Query('keyword') keyword: string,
    @Query('page') page: number,
    @Query('perPage') perPage: number
  ): Promise<Folder[]> {
    try {
      const userId = req.user.id;
      console.log('Searching unshared folders for user:', userId, 'keyword:', keyword);

      const unsharedFolders = await this.folderService.searchUnsharedFolders(
        keyword,
        userId,
        page,
        perPage
      );
      console.log('Search Unshared Folders:', unsharedFolders);

      return unsharedFolders;
    } catch (error) {
      console.error('Error searching unshared folders:', error.message);
      throw error;
    }
  }

  @Get('search/my-shared')
  async searchMySharedFolders(
    @Req() req,
    @Query('keyword') keyword: string,
    @Query('page') page: number,
    @Query('perPage') perPage: number
  ): Promise<Folder[]> {
    try {
      const userId = req.user.id;
      console.log('Searching my shared folders for user:', userId, 'keyword:', keyword);

      const mySharedFolders = await this.folderService.searchMySharedFolders(
        keyword,
        userId,
        page,
        perPage
      );
      console.log('Search My Shared Folders:', mySharedFolders);

      return mySharedFolders;
    } catch (error) {
      console.error('Error searching my shared folders:', error.message);
      throw error;
    }
  }

  @Get('shared/count')
  async getSharedFolderCount(): Promise<{ folderName: string; shareCount: number }[]> {
    return this.folderService.getSharedFolderCount();
  }

  @Get('shared-users')
  async getSharedUsers(@Req() req) {
    const userId = req.user.id || req.user._id;
    return this.folderService.getSharedUsers(userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateFolderDto: createFolderDTOlayer
  ): Promise<Folder> {
    console.log('Updating folder:', id, updateFolderDto);

    return this.folderService.update(id, updateFolderDto);
  }

  // @Delete('remove-selected')
  // async removeSelected(@Body('folderIds') folderIds: string[]): Promise<Folder[]> {
  //   return await this.folderService.removeSelected(folderIds);
  // }

  @Post(':id/share')
  async shareFolder(@Param('id') id: string, @Body('userIdToShareWith') userIdToShareWith: string) {
    return this.folderService.shareFolder(id, userIdToShareWith);
  }

  @Post(':id/invite-by-email')
  async inviteUserByEmail(
    @Param('id') id: string,
    @Body() body: { email: string; access?: string },
    @Req() req
  ) {
    const currentUserId = req.user.id;
    return this.folderService.inviteUserByEmail(
      id,
      body.email,
      body.access || 'view',
      currentUserId
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Folder> {
    return this.folderService.remove(id);
  }

  @Delete(':folderId/ignore-access/:userIdToIgnore')
  async ignoreAccess(
    @Param('folderId') folderId: string,
    @Param('userIdToIgnore') userIdToIgnore: string
  ) {
    console.log('Folder ID:', folderId);
    console.log('User ID to ignore:', userIdToIgnore);
    return this.folderService.ignoreAccess(folderId, userIdToIgnore);
  }

  @Get('folder-creation-data')
  async getFolderCreationData(): Promise<{ date: Date; folderCount: number }[]> {
    return this.folderService.getFolderCreationData();
  }
  @Patch('toggle-access/:id')
  async toggleAccess(
    @Param('id') id: string,
    @Body() body?: { access?: string }
  ): Promise<boolean> {
    try {
      console.log('Toggling access for folder:', id, 'with access:', body?.access);
      const success = await this.folderService.updateFolderAccess(id, body?.access);
      return success;
    } catch (error) {
      console.error('Failed to toggle folder access:', error);
      throw error;
    }
  }

  @Patch('assign-access/:id')
  async assignAccess(
    @Param('id') id: string,
    @Body() body: { userId: string; access: string },
    @Req() req
  ): Promise<boolean> {
    try {
      const currentUserId = req.user.id;
      console.log(
        'Assigning folder access:',
        id,
        'to user:',
        body.userId,
        'with access:',
        body.access,
        'by:',
        currentUserId
      );
      const success = await this.folderService.assignFolderAccess(
        id,
        body.userId,
        body.access,
        currentUserId
      );
      return success;
    } catch (error) {
      console.error('Failed to assign folder access:', error);
      throw error;
    }
  }

  @Get('getbyidfolder/:id')
  async findOne(@Param('id') id: string, @Req() req): Promise<Folder> {
    const userId = req.user.id;
    console.log(userId);
    return this.folderService.findOne(id, userId);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Req() req): Promise<Folder> {
    const userId = req.user.id;
    console.log('Finding folder by ID:', id, 'for user:', userId);
    return this.folderService.findOne(id, userId);
  }

  @Get('test')
  async testEndpoint(): Promise<{ message: string }> {
    return { message: 'Folder controller is working' };
  }

  @Get('access-level/:id')
  async getUserAccessLevel(@Param('id') id: string, @Req() req): Promise<{ access: string }> {
    const userId = req.user.id;
    const access = await this.folderService.getUserAccessLevel(id, userId);
    return { access };
  }

  /**
   * Opérations groupées sur les dossiers
   * POST /folder/bulkAction
   */
  @Post('bulkAction')
  async bulkAction(
    @Body()
    body: {
      action: 'delete' | 'move' | 'archive';
      ids: string[];
      targetFolderId?: string; // Pour l'action 'move'
    },
    @Req() req
  ) {
    const userId = req.user.id;
    return this.folderService.bulkAction(body.action, body.ids, userId, body.targetFolderId);
  }

  /**
   * Créer un dossier à partir d'un template
   * POST /folder/template
   */
  @Post('template')
  async createFromTemplate(
    @Body()
    body: {
      templateName: string;
      folderName: string;
      parentFolderId?: string;
    },
    @Req() req
  ) {
    const userId = req.user.id;
    return this.folderService.createFromTemplate(
      body.templateName,
      body.folderName,
      userId,
      body.parentFolderId
    );
  }

  /**
   * Invite user to folder via email
   * POST /folder/:id/invite
   */
  @Post(':id/invite')
  async inviteUserToFolder(
    @Param('id') folderId: string,
    @Body() body: { email: string; access?: string },
    @Req() req
  ) {
    const userId = req.user.id;
    return this.folderService.inviteUserToFolder(
      folderId,
      body.email,
      body.access || 'view',
      userId
    );
  }
}
