import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

import { Documents } from 'src/document/document.schema';
import { User } from 'src/users/users.schema';

@Schema()
export class Comment {
  _id: string;
  @Prop({ required: true })
  content: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Documents', required: true })
  document: Documents;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
