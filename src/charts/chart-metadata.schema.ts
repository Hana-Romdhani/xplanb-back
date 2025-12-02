import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { User } from '../users/users.schema';

@Schema()
export class ChartMetadata {
  _id: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  chartType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: User;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ type: Object })
  chartConfig?: any;

  @Prop({ type: [String], default: [] })
  sharedWithUsers: string[];
}

export const ChartMetadataSchema = SchemaFactory.createForClass(ChartMetadata);
