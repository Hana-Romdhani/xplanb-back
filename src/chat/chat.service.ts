import { Injectable, Logger } from '@nestjs/common';
import { ChatRepository } from './chat.repository';
import { CreateMessageDto } from './dto/chat.dto';
import { CreateConversationDto } from './dto/chat.dto';
import { Types } from 'mongoose';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private chatRepository: ChatRepository) {}

  async createMessage(userId: string, createMessageDto: CreateMessageDto) {
    try {
      const message = await this.chatRepository.createMessage({
        conversationId: new Types.ObjectId(createMessageDto.conversationId),
        senderId: new Types.ObjectId(userId),
        content: createMessageDto.content,
        type: createMessageDto.type || 'text',
        metadata: createMessageDto.metadata
      });

      // Update conversation's last message and activity
      await this.chatRepository.updateLastMessage(
        createMessageDto.conversationId,
        message._id.toString()
      );

      // Mark other participants' unread messages as read (for this conversation)
      // Note: This might need adjustment based on your requirements

      return await this.chatRepository
        .findMessagesByConversation(createMessageDto.conversationId, 1, 0)
        .then((messages) => messages[0]);
    } catch (error) {
      this.logger.error(`Error creating message: ${error.message}`);
      throw error;
    }
  }

  async getConversations(userId: string) {
    try {
      const conversations = await this.chatRepository.findConversationsByUser(userId);
      return conversations;
    } catch (error) {
      this.logger.error(`Error getting conversations: ${error.message}`);
      throw error;
    }
  }

  async getConversation(conversationId: string, userId: string) {
    try {
      const conversation = await this.chatRepository.findConversationById(conversationId);

      // Check if user is a participant
      const participantIds = conversation.participants.map((p: any) => {
        if (typeof p === 'object' && p._id) {
          return p._id.toString();
        }
        return String(p);
      });
      if (!participantIds.includes(userId)) {
        throw new Error('User is not a participant of this conversation');
      }

      return conversation;
    } catch (error) {
      this.logger.error(`Error getting conversation: ${error.message}`);
      throw error;
    }
  }

  async getMessages(conversationId: string, userId: string, limit: number = 50, skip: number = 0) {
    try {
      // Verify user has access
      const conversation = await this.chatRepository.findConversationById(conversationId);
      const participantIds = conversation.participants.map((p: any) => {
        if (typeof p === 'object' && p._id) {
          return p._id.toString();
        }
        return String(p);
      });
      if (!participantIds.includes(userId)) {
        throw new Error('User is not a participant of this conversation');
      }

      const messages = await this.chatRepository.findMessagesByConversation(
        conversationId,
        limit,
        skip
      );

      // Mark messages as read
      await this.chatRepository.markMessagesAsRead(conversationId, userId);

      return messages.reverse(); // Reverse to show oldest first
    } catch (error) {
      this.logger.error(`Error getting messages: ${error.message}`);
      throw error;
    }
  }

  async createConversation(userId: string, createConversationDto: CreateConversationDto) {
    try {
      // For direct conversations, check if one already exists
      if (
        createConversationDto.type === 'direct' ||
        (!createConversationDto.type && createConversationDto.participantIds.length === 2)
      ) {
        const existing = await this.chatRepository.findDirectConversation(
          userId,
          createConversationDto.participantIds.find((id) => id !== userId) ||
            createConversationDto.participantIds[0]
        );
        if (existing) {
          return existing;
        }
      }

      const participantIds = [
        userId,
        ...createConversationDto.participantIds.filter((id) => id !== userId)
      ].map((id) => new Types.ObjectId(id));

      const conversation = await this.chatRepository.createConversation({
        type: createConversationDto.type || (participantIds.length === 2 ? 'direct' : 'group'),
        participants: participantIds,
        name: createConversationDto.name
      });

      return await this.chatRepository.findConversationById(conversation._id.toString());
    } catch (error) {
      this.logger.error(`Error creating conversation: ${error.message}`);
      throw error;
    }
  }

  async getUnreadCount(userId: string) {
    try {
      const conversations = await this.chatRepository.findConversationsByUser(userId);
      const counts: Record<string, number> = {};

      for (const conv of conversations) {
        const count = await this.chatRepository.getUnreadCount(conv._id.toString(), userId);
        counts[conv._id.toString()] = count;
      }

      return counts;
    } catch (error) {
      this.logger.error(`Error getting unread count: ${error.message}`);
      throw error;
    }
  }

  async markAsRead(conversationId: string, userId: string) {
    try {
      await this.chatRepository.markMessagesAsRead(conversationId, userId);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking as read: ${error.message}`);
      throw error;
    }
  }
}
