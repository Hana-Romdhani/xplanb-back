/**
 * DocumentVersion Schema
 *
 * Ce schema stocke les versions historiques des documents pour permettre
 * le versioning et la restauration de versions antérieures.
 *
 * Emplacement: src/document/document-version.schema.ts
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from 'src/users/users.schema';

export type DocumentVersionDocument = DocumentVersion & Document;

@Schema({ timestamps: true })
export class DocumentVersion {
  @Prop({ type: Types.ObjectId, ref: 'Documents', required: true })
  documentId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  version: number;

  @Prop({ type: Object, required: true })
  content: any; // Editor.js JSON content

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: String, required: false })
  description?: string; // Description optionnelle de la version

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const DocumentVersionSchema = SchemaFactory.createForClass(DocumentVersion);
