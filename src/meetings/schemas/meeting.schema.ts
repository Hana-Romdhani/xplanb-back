import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MeetingDocument = Meeting & Document;

@Schema({ timestamps: true })
export class Meeting {
  _id: string;

  @Prop({ required: true })
  title: string;

  @Prop({ type: Types.ObjectId, ref: 'Documents', required: false })
  docId?: Types.ObjectId;

  @Prop({ required: false })
  folderId?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: false, default: [] })
  participants: Types.ObjectId[];

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: false })
  endTime?: Date;

  @Prop({ required: false })
  transcript?: string;

  @Prop({ required: false })
  recordingUrl?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ required: false })
  meetingRoomId?: string;

  @Prop({ required: false, default: 'scheduled' })
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

  @Prop({ required: false })
  description?: string;

  @Prop({ required: false })
  duration?: number; // in minutes
}

export const MeetingSchema = SchemaFactory.createForClass(Meeting);
