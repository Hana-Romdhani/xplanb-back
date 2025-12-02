/**
 * Versioning Module
 *
 * Module pour la gestion des versions de documents
 *
 * Emplacement: src/versioning/versioning.module.ts
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VersioningController } from './versioning.controller';
import { VersioningService } from './versioning.service';
import { Documents, DocumentsSchema } from '../document/document.schema';
import { DocumentVersion, DocumentVersionSchema } from '../document/document-version.schema';
import { Content, ContentSchema } from '../content/content.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Documents.name, schema: DocumentsSchema },
      { name: DocumentVersion.name, schema: DocumentVersionSchema },
      { name: Content.name, schema: ContentSchema }
    ])
  ],
  controllers: [VersioningController],
  providers: [VersioningService],
  exports: [VersioningService]
})
export class VersioningModule {}
