import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Schema as MongooseSchema } from 'mongoose';

@Schema()
export class Content extends Document {
  _id: string;
  @Prop({ required: true, unique: true, index: true })
  documentId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: Date.now })
  creationDate: Date;

  @Prop({ default: Date.now })
  updatedDate: Date;
}

export const ContentSchema = SchemaFactory.createForClass(Content);

// Add unique index to prevent duplicate content entries for the same document
ContentSchema.index({ documentId: 1 }, { unique: true });

export type ContentDocument = Content & Document;
