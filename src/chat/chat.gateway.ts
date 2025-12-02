import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatRepository } from './chat.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notifications.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/users.schema';
import { Types } from 'mongoose';

@WebSocketGateway({
  namespace: '/ws/chat',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, { socketId: string; userId: string }>();

  constructor(
    private readonly chatService: ChatService,
    private readonly chatRepository: ChatRepository,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
    @InjectModel(User.name) private userModel: Model<User>
  ) {}

  /**
   * Extract token from socket connection
   */
  private extractTokenFromSocket(client: Socket): string | null {
    return (
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '') ||
      (client.handshake.query?.token as string) ||
      null
    );
  }

  /**
   * Handle WebSocket connection
   */
  async handleConnection(client: Socket) {
    try {
      const token = this.extractTokenFromSocket(client);
      if (!token) {
        this.logger.warn('Connection rejected: No token provided');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.id || payload._id || payload.userId;

      if (!userId) {
        this.logger.warn('Connection rejected: No userId in token');
        client.disconnect();
        return;
      }

      client.data.userId = userId;
      client.data.userEmail = payload.email;

      // Store connected user
      this.connectedUsers.set(client.id, { socketId: client.id, userId });

      this.logger.log(`User ${payload.email || userId} connected to chat with socket ${client.id}`);

      // Join user's personal room for notifications
      await client.join(`user_${userId}`);

      // Emit connection status to other users
      this.server.emit('user_online', { userId });
    } catch (error) {
      this.logger.warn(`Connection rejected: Invalid token - ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.connectedUsers.delete(client.id);
      this.server.emit('user_offline', { userId });
      this.logger.log(`User ${userId} disconnected from chat`);
    }
  }

  /**
   * Join a conversation room
   */
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      // Verify user has access to conversation
      await this.chatService.getConversation(data.conversationId, userId);

      // Join the conversation room
      await client.join(`conversation_${data.conversationId}`);
      this.logger.log(`User ${userId} joined conversation ${data.conversationId}`);

      client.emit('conversation_joined', { conversationId: data.conversationId });
    } catch (error) {
      this.logger.error(`Error joining conversation: ${error.message}`);
      client.emit('error', { message: 'Failed to join conversation' });
    }
  }

  /**
   * Leave a conversation room
   */
  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    await client.leave(`conversation_${data.conversationId}`);
    this.logger.log(`User ${client.data.userId} left conversation ${data.conversationId}`);
  }

  /**
   * Send a message
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { conversationId: string; content: string; type?: string; metadata?: any },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      // Get conversation to find all participants
      const conversation = await this.chatService.getConversation(data.conversationId, userId);

      // Create message in database directly to get the created document
      const createdMessage = await this.chatRepository.createMessage({
        conversationId: new Types.ObjectId(data.conversationId),
        senderId: new Types.ObjectId(userId),
        content: data.content,
        type: data.type || 'text',
        metadata: data.metadata
      });

      // Update conversation's last message and activity
      await this.chatRepository.updateLastMessage(
        data.conversationId,
        createdMessage._id.toString()
      );

      // Get sender info for the message
      const sender = await this.userModel
        .findById(userId)
        .select('firstName lastName email picture');

      // Get full message with sender info (retry if not found immediately)
      let fullMessage;
      let retries = 3;
      while (retries > 0) {
        const messages = await this.chatRepository.findMessagesByConversation(
          data.conversationId,
          1,
          0
        );
        fullMessage = messages[0];
        if (fullMessage) break;

        // Wait a bit and retry (message might not be indexed yet)
        await new Promise((resolve) => setTimeout(resolve, 100));
        retries--;
      }

      // Get sender info for notifications (move before usage)
      const senderForNotifications =
        sender || (await this.userModel.findById(userId).select('firstName lastName email'));
      const senderName = senderForNotifications
        ? `${senderForNotifications.firstName} ${senderForNotifications.lastName}`
        : 'Someone';

      // Get all participant IDs
      const participantIds = conversation.participants.map((p: any) => {
        if (typeof p === 'object' && p._id) {
          return p._id.toString();
        }
        return String(p);
      });

      // If still not found, create the serialized message from what we have
      if (!fullMessage) {
        this.logger.warn(`Message not found in query, using created message directly`);
        const senderInfo = sender
          ? {
              _id: sender._id.toString(),
              firstName: sender.firstName,
              lastName: sender.lastName,
              email: sender.email,
              picture: sender.picture
            }
          : null;

        const serializedMessage = {
          _id: createdMessage._id.toString(),
          conversationId: createdMessage.conversationId.toString(),
          senderId: senderInfo || userId,
          content: createdMessage.content,
          read: createdMessage.read || false,
          readAt: createdMessage.readAt,
          type: createdMessage.type || 'text',
          metadata: createdMessage.metadata,
          createdAt: createdMessage.createdAt || new Date(),
          updatedAt: createdMessage.updatedAt || new Date()
        };

        // Get list of socket rooms for debugging
        const conversationRoom = `conversation_${data.conversationId}`;
        const senderRoom = `user_${userId}`;

        // Broadcast to all users in the conversation room
        this.server.to(conversationRoom).emit('new_message', serializedMessage);
        const conversationRoomSockets = await this.server.in(conversationRoom).fetchSockets();
        this.logger.log(
          `Broadcasted message to conversation room: ${conversationRoom} (${conversationRoomSockets.length} sockets)`
        );
        conversationRoomSockets.forEach((s) => {
          this.logger.log(`  - Socket ${s.id} (User: ${s.data.userId})`);
        });

        // Send to sender's personal room ONLY if they're not in conversation room
        const senderInConversationRoom = conversationRoomSockets.some(
          (s) => s.data.userId === userId
        );
        if (!senderInConversationRoom) {
          this.server.to(senderRoom).emit('new_message', serializedMessage);
          const senderRoomSockets = await this.server.in(senderRoom).fetchSockets();
          this.logger.log(
            `Sent message to sender's personal room: ${senderRoom} (${senderRoomSockets.length} sockets) - sender not in conversation room`
          );
        } else {
          this.logger.log(
            `Skipped sending to sender's personal room - already in conversation room`
          );
        }

        // Send to each participant's personal room
        for (const participantId of participantIds) {
          if (participantId === userId) continue;

          const participantRoom = `user_${participantId}`;

          // Only send to personal room if not in conversation room (to avoid duplicate)
          const inConversationRoom = conversationRoomSockets.some(
            (s) => s.data.userId === participantId
          );

          if (!inConversationRoom) {
            // Send message to user's personal room only if not in conversation room
            this.server.to(participantRoom).emit('new_message', serializedMessage);
            const participantRoomSockets = await this.server.in(participantRoom).fetchSockets();
            this.logger.log(
              `Sent message to user room: ${participantRoom} (${participantRoomSockets.length} sockets) - not in conversation room`
            );
          } else {
            this.logger.log(
              `User ${participantId} is in conversation room, skipping personal room to avoid duplicate`
            );
          }

          // Create notification
          this.notificationsService
            .create({
              recipient: participantId,
              title: 'New Message',
              message: `${senderName}: ${data.content.substring(0, 100)}${data.content.length > 100 ? '...' : ''}`,
              type: NotificationType.CHAT_MESSAGE,
              metadata: {
                conversationId: data.conversationId,
                messageId: createdMessage._id.toString(),
                senderId: userId,
                senderName: senderName
              }
            })
            .catch((err) => {
              this.logger.error(
                `Failed to create notification for user ${participantId}: ${err.message}`
              );
            });
        }

        this.logger.log(`Message sent in conversation ${data.conversationId} by user ${userId}`);
        return;
      }

      // Ensure message is properly serialized with string IDs
      let senderIdSerialized: any;
      if (typeof fullMessage.senderId === 'object' && fullMessage.senderId) {
        // If populated, convert to plain object
        if (
          'toObject' in fullMessage.senderId &&
          typeof (fullMessage.senderId as any).toObject === 'function'
        ) {
          senderIdSerialized = (fullMessage.senderId as any).toObject();
        } else {
          // If it's already a plain object or has _id
          senderIdSerialized = fullMessage.senderId;
        }
      } else {
        // If not populated, use the sender we fetched
        senderIdSerialized = sender
          ? {
              _id: sender._id.toString(),
              firstName: sender.firstName,
              lastName: sender.lastName,
              email: sender.email,
              picture: sender.picture
            }
          : userId;
      }

      const serializedMessage = {
        ...fullMessage.toObject(),
        _id: fullMessage._id.toString(),
        conversationId: fullMessage.conversationId.toString(),
        senderId: senderIdSerialized,
        createdAt: fullMessage.createdAt,
        updatedAt: fullMessage.updatedAt
      };

      // Get list of socket rooms for debugging
      const conversationRoom = `conversation_${data.conversationId}`;
      const senderRoom = `user_${userId}`;

      // Broadcast to all users in the conversation room (for real-time display)
      // This includes the sender if they're in the room
      this.server.to(conversationRoom).emit('new_message', serializedMessage);
      const conversationRoomSockets = await this.server.in(conversationRoom).fetchSockets();
      this.logger.log(
        `Broadcasted message to conversation room: ${conversationRoom} (${conversationRoomSockets.length} sockets)`
      );
      conversationRoomSockets.forEach((s) => {
        this.logger.log(`  - Socket ${s.id} (User: ${s.data.userId})`);
      });

      // Send to sender's personal room ONLY if they're not in conversation room
      const senderInConversationRoom = conversationRoomSockets.some(
        (s) => s.data.userId === userId
      );
      if (!senderInConversationRoom) {
        this.server.to(senderRoom).emit('new_message', serializedMessage);
        const senderRoomSockets = await this.server.in(senderRoom).fetchSockets();
        this.logger.log(
          `Sent message to sender's personal room: ${senderRoom} (${senderRoomSockets.length} sockets) - sender not in conversation room`
        );
      } else {
        this.logger.log(`Skipped sending to sender's personal room - already in conversation room`);
      }

      // Send to each participant's personal room (for notifications and offline users)
      for (const participantId of participantIds) {
        // Skip sender (already sent above)
        if (participantId === userId) continue;

        const participantRoom = `user_${participantId}`;

        // Only send to personal room if not in conversation room (to avoid duplicate)
        const inConversationRoom = conversationRoomSockets.some(
          (s) => s.data.userId === participantId
        );

        if (!inConversationRoom) {
          // Send message to user's personal room only if not in conversation room
          this.server.to(participantRoom).emit('new_message', serializedMessage);
          const participantRoomSockets = await this.server.in(participantRoom).fetchSockets();
          this.logger.log(
            `Sent message to user room: ${participantRoom} (${participantRoomSockets.length} sockets) - not in conversation room`
          );
        } else {
          this.logger.log(
            `User ${participantId} is in conversation room, skipping personal room to avoid duplicate`
          );
        }

        // Create notification for this participant
        this.notificationsService
          .create({
            recipient: participantId,
            title: 'New Message',
            message: `${senderName}: ${data.content.substring(0, 100)}${data.content.length > 100 ? '...' : ''}`,
            type: NotificationType.CHAT_MESSAGE,
            metadata: {
              conversationId: data.conversationId,
              messageId: createdMessage._id.toString(),
              senderId: userId,
              senderName: senderName
            }
          })
          .catch((err) => {
            this.logger.error(
              `Failed to create notification for user ${participantId}: ${err.message}`
            );
          });
      }

      this.logger.log(`Message sent in conversation ${data.conversationId} by user ${userId}`);
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  /**
   * Mark messages as read
   */
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      await this.chatService.markAsRead(data.conversationId, userId);
      this.server.to(`conversation_${data.conversationId}`).emit('messages_read', {
        conversationId: data.conversationId,
        userId
      });
    } catch (error) {
      this.logger.error(`Error marking as read: ${error.message}`);
      client.emit('error', { message: 'Failed to mark as read' });
    }
  }

  /**
   * Get online users for a conversation
   */
  @SubscribeMessage('get_online_users')
  async handleGetOnlineUsers(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket
  ) {
    try {
      const conversation = await this.chatService.getConversation(
        data.conversationId,
        client.data.userId
      );
      const participantIds = conversation.participants.map((p: any) =>
        typeof p === 'object' ? p._id.toString() : p.toString()
      );

      // Get online users from connected users
      const onlineUserIds = Array.from(this.connectedUsers.values())
        .map((u) => u.userId)
        .filter((userId) => participantIds.includes(userId));

      client.emit('online_users', { userIds: onlineUserIds });
    } catch (error) {
      this.logger.error(`Error getting online users: ${error.message}`);
      client.emit('error', { message: 'Failed to get online users' });
    }
  }
}
