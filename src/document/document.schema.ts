import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Content } from 'src/content/content.schema';
import { User } from 'src/users/users.schema';

export type DocumentsDocument = Documents & Document;

@Schema()
export class Documents {
  @Prop({ required: true })
  Title: string;
  @Prop({ type: Date, default: Date.now })
  createdDate: Date;

  @Prop({ type: Date, default: Date.now })
  updatedDate: Date;

  @Prop({ type: [String], default: [] })
  contentType: string[];
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Folder' })
  folderId: Types.ObjectId;
  @Prop({ default: false })
  archived: boolean;

  // Nouveaux champs pour le versioning et la co-édition
  @Prop({ type: Number, default: 1 })
  version: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'DocumentVersion' }] })
  previousVersions: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastEditedBy: Types.ObjectId;

  // Content is stored in Content collection, not here

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  sharedWith: Types.ObjectId[];

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User', required: true },
        access: { type: String, enum: ['view', 'edit'], default: 'view' }
      }
    ],
    default: []
  })
  userAccess: Array<{ userId: Types.ObjectId; access: string }>;

  @Prop({ type: String, enum: ['view', 'comment', 'edit'], default: 'edit' })
  defaultAccess: string;

  // Document statistics
  @Prop({ type: Number, default: 0 })
  viewCount: number;

  @Prop({ type: Number, default: 0 })
  editCount: number;

  @Prop({ type: Number, default: 0 })
  commentCount: number;

  @Prop({ type: Number, default: 0 })
  shareCount: number;

  @Prop({ type: Date, required: false })
  lastViewedAt?: Date;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  viewedBy: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  favoritedBy: Types.ObjectId[];
}

export const DocumentsSchema = SchemaFactory.createForClass(Documents);
