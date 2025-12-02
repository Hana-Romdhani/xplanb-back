import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  EVENT_REMINDER = 'event_reminder',
  EVENT_CREATED = 'event_created',
  EVENT_UPDATED = 'event_updated',
  EVENT_CANCELLED = 'event_cancelled',
  MEETING_STARTED = 'meeting_started',
  MEETING_INVITATION = 'meeting_invitation',
  MEETING_JOINED = 'meeting_joined',
  COMMENT = 'comment',
  DOCUMENT_VIEWED = 'document_viewed',
  DOCUMENT_EDITED = 'document_edited',
  DOCUMENT_COMMENTED = 'document_commented',
  CHAT_MESSAGE = 'chat_message',
  SHARE = 'share',
  GENERAL = 'general'
}

@Schema({ timestamps: true })
export class Notification {
  _id: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipient: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({
    type: String,
    enum: NotificationType,
    required: true
  })
  type: NotificationType;

  @Prop({ type: Boolean, default: false })
  read: boolean;

  @Prop({ type: Date, default: Date.now })
  readAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'CalendarEvent', required: false })
  eventId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Meeting', required: false })
  meetingId?: Types.ObjectId;

  @Prop({ type: Object, required: false })
  metadata?: any;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
