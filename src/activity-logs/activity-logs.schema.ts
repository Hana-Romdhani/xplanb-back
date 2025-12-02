import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActivityLogDocument = ActivityLog & Document;

@Schema({ timestamps: true })
export class ActivityLog {
  _id: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  action: string;

  @Prop({ required: false })
  resourceType?: string; // 'document', 'folder', 'meeting', etc.

  @Prop({ required: false })
  resourceId?: string;

  @Prop({ required: false })
  details?: string;

  @Prop({ required: false })
  ipAddress?: string;

  @Prop({ required: false })
  userAgent?: string;

  @Prop({ required: false })
  device?: string;

  @Prop({ required: false })
  location?: string;

  // Enriched fields (not in database, added when fetching)
  resourceTitle?: string;
  resourceFolder?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
