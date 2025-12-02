import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './chat.schema';
import { Conversation, ConversationDocument } from './chat.schema';

@Injectable()
export class ChatRepository {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>
  ) {}

  private toObjectId(id: string | Types.ObjectId): Types.ObjectId {
    if (id instanceof Types.ObjectId) {
      return id;
    }
    try {
      return new Types.ObjectId(id);
    } catch (err) {
      throw new Error(`Invalid ObjectId: ${id}`);
    }
  }

  // Message methods
  async createMessage(messageData: Partial<Message>): Promise<MessageDocument> {
    const message = new this.messageModel(messageData);
    return message.save();
  }

  async findMessagesByConversation(conversationId: string, limit: number = 50, skip: number = 0) {
    const convId = this.toObjectId(conversationId);
    return this.messageModel
      .find({ conversationId: convId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('senderId', 'firstName lastName email picture')
      .exec();
  }

  async markMessagesAsRead(conversationId: string, userId: string) {
    const convId = this.toObjectId(conversationId);
    const userObjectId = this.toObjectId(userId);
    return this.messageModel
      .updateMany(
        { conversationId: convId, senderId: { $ne: userObjectId }, read: false },
        { read: true, readAt: new Date() }
      )
      .exec();
  }

  async getUnreadCount(conversationId: string, userId: string) {
    const convId = this.toObjectId(conversationId);
    const userObjectId = this.toObjectId(userId);
    return this.messageModel.countDocuments({
      conversationId: convId,
      senderId: { $ne: userObjectId },
      read: false
    });
  }

  // Conversation methods
  async createConversation(conversationData: Partial<Conversation>): Promise<ConversationDocument> {
    const conversation = new this.conversationModel(conversationData);
    return conversation.save();
  }

  async findConversationById(conversationId: string) {
    const convId = this.toObjectId(conversationId);
    return this.conversationModel
      .findById(convId)
      .populate('participants', 'firstName lastName email picture')
      .populate('lastMessage')
      .exec();
  }

  async findConversationsByUser(userId: string) {
    const userObjectId = this.toObjectId(userId);
    return this.conversationModel
      .find({ participants: userObjectId })
      .sort({ lastActivity: -1 })
      .populate('participants', 'firstName lastName email picture')
      .populate('lastMessage')
      .exec();
  }

  async findDirectConversation(userId1: string, userId2: string) {
    const id1 = this.toObjectId(userId1);
    const id2 = this.toObjectId(userId2);
    return this.conversationModel
      .findOne({
        type: 'direct',
        participants: { $all: [id1, id2], $size: 2 }
      })
      .populate('participants', 'firstName lastName email picture')
      .populate('lastMessage')
      .exec();
  }

  async updateConversation(conversationId: string, updateData: Partial<Conversation>) {
    const convId = this.toObjectId(conversationId);
    return this.conversationModel
      .findByIdAndUpdate(convId, updateData, { new: true })
      .populate('participants', 'firstName lastName email picture')
      .populate('lastMessage')
      .exec();
  }

  async updateLastMessage(conversationId: string, messageId: string) {
    const convId = this.toObjectId(conversationId);
    const msgId = this.toObjectId(messageId);
    return this.conversationModel
      .findByIdAndUpdate(convId, { lastMessage: msgId, lastActivity: new Date() }, { new: true })
      .exec();
  }
}
