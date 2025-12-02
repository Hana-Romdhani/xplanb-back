import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PomodoroSessionDocument = PomodoroSession & Document;

@Schema({ timestamps: true })
export class PomodoroSession {
  _id: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: false })
  endTime?: Date;

  @Prop({
    type: String,
    enum: ['work', 'break', 'long_break'],
    required: true
  })
  type: string;

  @Prop({ required: true })
  duration: number; // in minutes

  @Prop({ required: false })
  completed: boolean;

  @Prop({ required: false })
  interrupted: boolean;

  @Prop({ required: false })
  interruptionReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const PomodoroSessionSchema = SchemaFactory.createForClass(PomodoroSession);
