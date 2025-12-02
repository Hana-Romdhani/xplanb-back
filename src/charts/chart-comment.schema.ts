import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { User } from '../users/users.schema';

@Schema()
export class ChartComment {
  _id: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ required: true })
  chartId: string;

  @Prop({ type: Object })
  dataPoint?: {
    label: string;
    value: number;
    datasetIndex: number;
  };

  @Prop({ type: Object })
  position?: {
    x: number;
    y: number;
  };
}

export const ChartCommentSchema = SchemaFactory.createForClass(ChartComment);
