/**
 * Shares Module
 *
 * Module pour la gestion des partages de documents et dossiers
 *
 * Emplacement: src/shares/shares.module.ts
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';
import { Share, ShareSchema } from './shares.schema';
import { Documents, DocumentsSchema } from '../document/document.schema';
import { Folder, FolderSchema } from '../folder/folder.schema';
import { User, UserSchema } from '../users/users.schema';
import { DocumentModule } from '../document/document.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Share.name, schema: ShareSchema },
      { name: Documents.name, schema: DocumentsSchema },
      { name: Folder.name, schema: FolderSchema },
      { name: User.name, schema: UserSchema }
    ]),
    DocumentModule
  ],
  controllers: [SharesController],
  providers: [SharesService],
  exports: [SharesService]
})
export class SharesModule {}
