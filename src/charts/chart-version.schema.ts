import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { User } from '../users/users.schema';

@Schema()
export class ChartVersion {
  _id: string;

  @Prop({ required: true })
  version: number;

  @Prop({ type: Object, required: true })
  chartData: any;

  @Prop({ type: Object, required: true })
  chartOptions: any;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: User;

  @Prop()
  description?: string;

  @Prop({ default: false })
  isActive: boolean;

  @Prop({ required: true })
  chartId: string;
}

export const ChartVersionSchema = SchemaFactory.createForClass(ChartVersion);
