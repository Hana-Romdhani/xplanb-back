import { ConflictException, Injectable } from '@nestjs/common';
import { Folder } from './folder.schema';
import { FolderRepository } from './folder.repository';
import { createFolderDTOlayer } from './dto/create-folder.dto';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service'; // Importez UserService
import { EmailService } from '../email/email.service'; // Importez UserService

@Injectable()
export class FolderService {
  constructor(
    private folderRepository: FolderRepository,
    private userService: UsersService,
    private emailService: EmailService // Correctement injecté
  ) {}

  async findAll(userId: string, page: number = 1, perPage: number = 3): Promise<Folder[]> {
    const skip = Math.max(0, (page - 1) * perPage);
    console.log(`Fetching folders for user ${userId}, page: ${page}, and perPage: ${perPage}`);
    return this.folderRepository.findAll(userId, skip, perPage);
  }
  async search(keyword: string, userId: string, page: number, perPage: number): Promise<Folder[]> {
    const skip = (page - 1) * perPage;

    return this.folderRepository.search(keyword, userId, skip, perPage);
  }

  async findOne(id: string, userId: string) {
    console.log('FolderService.findOne called with id:', id, 'userId:', userId);
    const folder = await this.folderRepository.findOne(id, userId);
    if (!folder) {
      throw new NotFoundException(`Folder with ID ${id} not found or access denied`);
    }
    return folder;
  }

  async create(createFolderDto: createFolderDTOlayer, user: string): Promise<createFolderDTOlayer> {
    return this.folderRepository.create(createFolderDto, user);
  }

  async update(id: string, updateFolderDto: any) {
    return this.folderRepository.update(id, updateFolderDto);
  }

  async remove(id: string) {
    return this.folderRepository.remove(id);
  }
  async shareFolder(folderId: string, userIdToShareWith: string): Promise<Folder> {
    const folder = await this.folderRepository.findById(folderId);

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (folder.sharedWith.some((user) => user._id === userIdToShareWith)) {
      throw new ConflictException('Folder already shared with this user');
    }

    const userToShareWith = await this.userService.findById(userIdToShareWith);

    if (!userToShareWith) {
      throw new NotFoundException('User not found');
    }

    folder.sharedWith.push(userToShareWith);

    return this.folderRepository.update(folderId, folder);
  }

  /**
   * Invite user to folder by email
   */
  async inviteUserByEmail(
    folderId: string,
    email: string,
    access: string = 'view',
    currentUserId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const folder = await this.folderRepository.findById(folderId);

      if (!folder) {
        throw new NotFoundException('Folder not found');
      }

      // Check if current user is the owner or has admin rights
      if (folder.user?.toString() !== currentUserId) {
        const currentUser = await this.userService.findById(currentUserId);
        if (!currentUser || !currentUser.accountType?.includes('ADMIN')) {
          throw new Error('Only the folder owner or admin can invite users');
        }
      }

      // Check if user exists with this email
      const existingUser = await this.userService.findOneByEmail(email);

      if (existingUser) {
        // User exists, add them to the folder
        const isAlreadyShared = folder.sharedWith.some(
          (user) => user._id.toString() === existingUser._id.toString()
        );
        if (isAlreadyShared) {
          return { success: false, message: 'User is already invited to this folder' };
        }

        // Add user to sharedWith if not already there
        folder.sharedWith.push(existingUser._id as any);

        // Update or add user access level
        const existingUserAccess = folder.userAccess || [];
        const userAccessIndex = existingUserAccess.findIndex(
          (ua) => ua.userId.toString() === existingUser._id.toString()
        );

        if (userAccessIndex >= 0) {
          existingUserAccess[userAccessIndex].access = access;
        } else {
          existingUserAccess.push({ userId: existingUser._id as any, access });
        }

        // Update folder with new shared user and per-user access level
        await this.folderRepository.update(folderId, {
          sharedWith: folder.sharedWith,
          userAccess: existingUserAccess
        });

        return { success: true, message: 'User has been invited and added to the folder' };
      } else {
        // User doesn't exist - frontend will send invitation email via Resend
        // Return signup URL for frontend to send in email
        const signupUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/signup?email=${encodeURIComponent(email)}&folder=${folderId}&access=${access}`;

        // Frontend will handle sending invitation email via Resend
        // Just return success - frontend already has folder info
        return { success: true, message: 'User invited to folder (frontend will send email)' };
      }
    } catch (error) {
      console.error('Failed to invite user by email:', error);
      return { success: false, message: `Failed to invite user: ${error.message}` };
    }
  }

  async getSharedFoldersForUser(userId: string): Promise<Folder[]> {
    return this.folderRepository.getSharedFoldersForUser(userId);
  }

  // New method to get only unshared folders (owned by user but not shared with others)
  async getUnsharedFoldersForUser(
    userId: string,
    page: number = 1,
    perPage: number = 3
  ): Promise<Folder[]> {
    const skip = Math.max(0, (page - 1) * perPage);
    console.log(`Getting unshared folders for user ${userId}, page: ${page}, perPage: ${perPage}`);
    return this.folderRepository.getUnsharedFoldersForUser(userId, skip, perPage);
  }

  // New method to get folders owned by user that are shared with others
  async getMySharedFoldersForUser(
    userId: string,
    page: number = 1,
    perPage: number = 3
  ): Promise<Folder[]> {
    const skip = Math.max(0, (page - 1) * perPage);
    console.log(`Getting my shared folders for user ${userId}, page: ${page}, perPage: ${perPage}`);
    return this.folderRepository.getMySharedFoldersForUser(userId, skip, perPage);
  }

  // New method to search unshared folders only
  async searchUnsharedFolders(
    keyword: string,
    userId: string,
    page: number,
    perPage: number
  ): Promise<Folder[]> {
    const skip = (page - 1) * perPage;
    console.log(`Searching unshared folders for user ${userId} with keyword: ${keyword}`);
    return this.folderRepository.searchUnsharedFolders(keyword, userId, skip, perPage);
  }

  // New method to search my shared folders only
  async searchMySharedFolders(
    keyword: string,
    userId: string,
    page: number,
    perPage: number
  ): Promise<Folder[]> {
    const skip = (page - 1) * perPage;
    console.log(`Searching my shared folders for user ${userId} with keyword: ${keyword}`);
    return this.folderRepository.searchMySharedFolders(keyword, userId, skip, perPage);
  }

  async ignoreAccess(folderId: string, userIdToIgnore: string): Promise<Folder> {
    console.log('Folder ID:', folderId);
    console.log('User ID to ignore:', userIdToIgnore);

    const folder = await this.folderRepository.findById(folderId);

    if (!folder) {
      console.log('Folder not found');
      throw new NotFoundException('Folder not found');
    }

    folder.sharedWith = folder.sharedWith.filter((user) => user._id.toString() !== userIdToIgnore);

    const updatedFolder = await this.folderRepository.update(folderId, folder);

    try {
      const userToIgnore = await this.userService.findById(userIdToIgnore);

      if (!userToIgnore) {
        throw new NotFoundException('User not found');
      }

      const userEmail = userToIgnore.email;
      const folderName = folder.Name;

      const subject = `Autorisation`;
      const text = `Bonjour ${userToIgnore.lastName}, Accès au dossier"${folderName}"ignoré.`;
      await this.emailService.sendEmail({
        to: userEmail,
        subject,
        text,
        html: '<p>Bonjour ${userToIgnore.lastName}, Accès au dossier"${folderName}"ignoré.</p>'
      });
      console.log("E-mail envoyé à l'utilisateur ignoré avec succès !");
    } catch (error) {
      console.error("Erreur lors de l'envoi de l'e-mail à l'utilisateur ignoré :", error);
    }

    return updatedFolder;
  }

  async getFolderCreationData(): Promise<{ date: Date; folderCount: number }[]> {
    return this.folderRepository.aggregateFolderCreationData();
  }
  async updateFolderAccess(folderId: string, newAccess?: string): Promise<boolean> {
    try {
      const folder = await this.folderRepository.findById(folderId);

      if (!folder) {
        throw new Error('Folder not found');
      }

      // This method is deprecated - use assignFolderAccess for per-user access instead
      console.warn(
        'updateFolderAccess is deprecated. Use assignFolderAccess for per-user access control.'
      );
      return true;
    } catch (error) {
      console.error('Failed to update folder access:', error);
      return false;
    }
  }

  async assignFolderAccess(
    folderId: string,
    userId: string,
    access: string,
    currentUserId: string
  ): Promise<boolean> {
    try {
      const folder = await this.folderRepository.findById(folderId);

      if (!folder) {
        throw new Error('Folder not found');
      }

      // Check if current user is the owner or has admin rights
      if (folder.user?.toString() !== currentUserId) {
        // Check if user is admin
        const currentUser = await this.userService.findById(currentUserId);
        if (!currentUser || !currentUser.accountType?.includes('ADMIN')) {
          throw new Error('Only the folder owner or admin can assign access rights');
        }
      }

      // Check if target user exists
      const targetUser = await this.userService.findById(userId);
      if (!targetUser) {
        throw new Error('Target user not found');
      }

      // Add user to sharedWith if not already there
      const isAlreadyShared = folder.sharedWith.some((user) => user._id.toString() === userId);
      if (!isAlreadyShared) {
        folder.sharedWith.push(userId as any);
      }

      // Update or add user access level
      const existingUserAccess = folder.userAccess || [];
      const userAccessIndex = existingUserAccess.findIndex((ua) => ua.userId.toString() === userId);

      if (userAccessIndex >= 0) {
        // Update existing access level
        existingUserAccess[userAccessIndex].access = access;
      } else {
        // Add new user access level
        existingUserAccess.push({ userId: userId as any, access });
      }

      // Update folder with new shared user and per-user access level
      await this.folderRepository.update(folderId, {
        sharedWith: folder.sharedWith,
        userAccess: existingUserAccess
      });

      return true;
    } catch (error) {
      console.error('Failed to assign folder access:', error);
      return false;
    }
  }

  async getSharedFolderCount(): Promise<{ folderName: string; shareCount: number }[]> {
    return this.folderRepository.getSharedFolderCount();
  }

  async getUserAccessLevel(folderId: string, userId: string): Promise<string> {
    try {
      const folder = await this.folderRepository.findById(folderId);

      if (!folder) {
        throw new Error('Folder not found');
      }

      // Owner always has full access
      if (folder.user?.toString() === userId) {
        return 'update';
      }

      // Check user-specific access level
      const userAccess = folder.userAccess?.find((ua) => ua.userId.toString() === userId);
      if (userAccess) {
        return userAccess.access;
      }

      // Default to view if shared but no specific access level set
      const isShared = folder.sharedWith?.some((user) => user._id.toString() === userId);
      return isShared ? 'view' : 'none';
    } catch (error) {
      console.error('Failed to get user access level:', error);
      return 'none';
    }
  }

  /**
   * Opérations groupées sur les dossiers
   */
  async bulkAction(
    action: 'delete' | 'move' | 'archive',
    folderIds: string[],
    userId: string,
    targetFolderId?: string
  ): Promise<{ success: boolean; processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      for (const folderId of folderIds) {
        try {
          // Vérifier les permissions
          const folder = await this.folderRepository.findById(folderId);
          if (!folder) {
            errors.push(`Folder ${folderId} not found`);
            continue;
          }

          if (folder.user?.toString() !== userId) {
            errors.push(`No permission for folder ${folderId}`);
            continue;
          }

          switch (action) {
            case 'delete':
              await this.folderRepository.remove(folderId);
              break;
            case 'move':
              if (!targetFolderId) {
                errors.push('Target folder ID required for move operation');
                continue;
              }
              await this.folderRepository.update(folderId, { parentFolderId: targetFolderId });
              break;
            case 'archive':
              await this.folderRepository.update(folderId, { archived: true });
              break;
          }
          processed++;
        } catch (error) {
          errors.push(`Error processing folder ${folderId}: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        processed,
        errors
      };
    } catch (error) {
      throw new Error(`Bulk action failed: ${error.message}`);
    }
  }

  /**
   * Créer un dossier à partir d'un template
   */
  async createFromTemplate(
    templateName: string,
    folderName: string,
    userId: string,
    parentFolderId?: string
  ): Promise<Folder> {
    try {
      // Templates prédéfinis
      const templates = {
        project: {
          Name: folderName,
          documents: [],
          contents: [],
          sharedWith: [],
          access: 'update'
        },
        meeting: {
          Name: folderName,
          documents: [],
          contents: [],
          sharedWith: [],
          access: 'update'
        },
        personal: {
          Name: folderName,
          documents: [],
          contents: [],
          sharedWith: [],
          access: 'update'
        }
      };

      const template = templates[templateName];
      if (!template) {
        throw new Error(`Template '${templateName}' not found`);
      }

      const createFolderDto: createFolderDTOlayer = {
        Name: folderName,
        ...template
      };

      if (parentFolderId) {
        createFolderDto.parentFolderId = parentFolderId;
      }

      return this.folderRepository.create(createFolderDto, userId);
    } catch (error) {
      throw new Error(`Failed to create folder from template: ${error.message}`);
    }
  }

  /**
   * Invite user to folder via email
   */
  async inviteUserToFolder(
    folderId: string,
    email: string,
    access: string = 'view',
    currentUserId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const folder = await this.folderRepository.findById(folderId);

      if (!folder) {
        return { success: false, message: 'Folder not found' };
      }

      // Check if current user is the owner or has admin rights
      if (folder.user?.toString() !== currentUserId) {
        const currentUser = await this.userService.findById(currentUserId);
        if (!currentUser || !currentUser.accountType?.includes('ADMIN')) {
          return { success: false, message: 'Only the folder owner or admin can invite users' };
        }
      }

      // Check if user exists
      const targetUser = await this.userService.findOneByEmail(email);
      if (!targetUser) {
        return { success: false, message: 'User with this email does not exist' };
      }

      // Check if user is already shared
      const isAlreadyShared = folder.sharedWith?.some(
        (user) => user._id.toString() === targetUser._id.toString()
      );
      if (isAlreadyShared) {
        return { success: false, message: 'User is already shared with this folder' };
      }

      // Add user to sharedWith
      await this.folderRepository.update(folderId, {
        $push: { sharedWith: targetUser._id }
      });

      // Update user access level
      const existingUserAccess = folder.userAccess || [];
      const userAccessIndex = existingUserAccess.findIndex(
        (ua) => ua.userId.toString() === targetUser._id.toString()
      );

      if (userAccessIndex >= 0) {
        existingUserAccess[userAccessIndex].access = access;
      } else {
        existingUserAccess.push({ userId: targetUser._id as any, access });
      }

      await this.folderRepository.update(folderId, {
        userAccess: existingUserAccess
      });

      return { success: true, message: 'Invitation sent successfully' };
    } catch (error) {
      console.error('Failed to invite user to folder:', error);
      return { success: false, message: 'Failed to send invitation' };
    }
  }

  async getSharedUsers(userId: string) {
    // Find all folders owned or shared with this user
    const folders = await this.folderRepository.findAllByUserOrSharedWith(userId);

    const userSet = new Set<string>();
    folders.forEach((folder) => {
      // Add folder owner (if not me)
      if (folder.user && folder.user._id.toString() !== userId) {
        userSet.add(folder.user._id.toString());
      }
      // Add all sharedWith users (if not me)
      if (folder.sharedWith && Array.isArray(folder.sharedWith)) {
        folder.sharedWith.forEach((shared: any) => {
          if (shared && shared._id && shared._id.toString() !== userId) {
            userSet.add(shared._id.toString());
          }
        });
      }
    });
    const ids = Array.from(userSet) as string[];
    if (!ids.length) return [];
    // Fetch minimal user info in bulk
    const users = await this.userService.findUsersByIds(ids, [
      '_id',
      'firstName',
      'lastName',
      'email',
      'picture'
    ]);
    return users;
  }
}
