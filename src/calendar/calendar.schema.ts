import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CalendarEventDocument = CalendarEvent & Document;

@Schema({ timestamps: true })
export class CalendarEvent {
  _id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: false })
  description?: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ type: [Types.ObjectId], ref: 'User', required: true })
  participants: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Documents', required: false })
  linkedDocId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Folder', required: false })
  linkedFolderId?: Types.ObjectId;

  @Prop({ type: String, required: false })
  meetingRoomId?: string;

  @Prop({ type: String, required: false })
  recordingUrl?: string;

  @Prop({
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled'
  })
  status: string;

  @Prop({ type: String, required: false })
  location?: string;

  @Prop({ type: Boolean, default: false })
  isRecurring: boolean;

  @Prop({ type: String, required: false })
  recurrencePattern?: string; // 'daily', 'weekly', 'monthly'

  @Prop({ type: Date, required: false })
  recurrenceEndDate?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const CalendarEventSchema = SchemaFactory.createForClass(CalendarEvent);
