import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ComplaintDocument = Complaint & Document;

@Schema({ timestamps: true })
export class Complaint {
  _id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: String, required: false })
  screenshot?: string;

  @Prop({
    type: String,
    enum: ['open', 'in_review', 'resolved'],
    default: 'open'
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: false })
  adminResponse?: string;

  @Prop({ type: Date, required: false })
  resolvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  resolvedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const ComplaintSchema = SchemaFactory.createForClass(Complaint);
