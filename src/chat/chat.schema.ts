import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;
export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Message {
  _id: string;

  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ type: Boolean, default: false })
  read: boolean;

  @Prop({ type: Date, default: Date.now })
  readAt?: Date;

  @Prop({ type: String, required: false })
  type?: string; // 'text', 'file', 'image', etc.

  @Prop({ type: Object, required: false })
  metadata?: any; // For file attachments, etc.

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Conversation {
  _id: string;

  @Prop({ type: String, enum: ['direct', 'group'], default: 'direct' })
  type: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  participants: Types.ObjectId[];

  @Prop({ type: String, required: false })
  name?: string; // For group chats

  @Prop({ type: Types.ObjectId, ref: 'Message', required: false })
  lastMessage?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  lastActivity: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
export const ConversationSchema = SchemaFactory.createForClass(Conversation);
