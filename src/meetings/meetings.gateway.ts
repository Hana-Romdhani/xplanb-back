import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MeetingsService } from './meetings.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/users.schema';
import { v4 as uuidv4 } from 'uuid';

interface MeetingMessagePayload {
  id: string;
  meetingRoomId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
    picture?: string;
  };
}

interface MeetingParticipantPayload {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  picture?: string;
  isConnected: boolean;
}

@WebSocketGateway({
  namespace: '/ws/meetings',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }
})
export class MeetingsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MeetingsGateway.name);

  private socketMeta = new Map<string, { meetingRoomId: string; userId: string }>();
  private meetingConnections = new Map<string, Map<string, Set<string>>>(); // roomId -> userId -> socketIds
  private meetingMessages = new Map<string, MeetingMessagePayload[]>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly meetingsService: MeetingsService,
    @InjectModel(User.name) private readonly userModel: Model<User>
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractTokenFromSocket(client);
      if (!token) {
        this.logger.warn('Connection rejected: No token provided');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.id;
      client.data.userEmail = payload.email;
      this.logger.log(`User ${payload.email || payload.id} connected (socket ${client.id})`);
    } catch (error) {
      this.logger.warn(`Connection rejected: Invalid token - ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) {
      return;
    }

    const { meetingRoomId, userId } = meta;
    this.removeConnection(meetingRoomId, userId, client.id);
    this.socketMeta.delete(client.id);

    client.leave(meetingRoomId);

    this.logger.log(`User ${userId} disconnected from meeting ${meetingRoomId}`);

    if (!this.isUserStillConnected(meetingRoomId, userId)) {
      this.server.to(meetingRoomId).emit('participant_left', {
        participantId: userId
      });
    }
  }

  @SubscribeMessage('join_meeting')
  async handleJoinMeeting(
    @MessageBody() data: { meetingRoomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const meetingRoomId = data?.meetingRoomId;
    if (!meetingRoomId) {
      client.emit('error', { message: 'Meeting room ID is required' });
      return;
    }

    try {
      const meeting = await this.meetingsService.joinMeetingByRoomId(meetingRoomId, userId);

      await client.join(meetingRoomId);
      client.data.meetingRoomId = meetingRoomId;
      this.socketMeta.set(client.id, { meetingRoomId, userId });
      this.addConnection(meetingRoomId, userId, client.id);

      const meetingObject =
        meeting && typeof (meeting as any).toObject === 'function'
          ? (meeting as any).toObject()
          : meeting;
      const participantsPayload = this.buildParticipantsPayload(
        meetingRoomId,
        meetingObject.participants ?? []
      );

      const messages = this.meetingMessages.get(meetingRoomId) || [];

      client.emit('meeting_state', {
        meeting: {
          _id: meetingObject._id?.toString?.() || meetingObject._id,
          title: meetingObject.title,
          meetingRoomId: meetingObject.meetingRoomId,
          startTime: meetingObject.startTime,
          status: meetingObject.status,
          createdBy: meetingObject.createdBy,
          description: meetingObject.description
        },
        participants: participantsPayload,
        messages
      });

      const joiningParticipant = participantsPayload.find((p) => p._id === userId);
      if (joiningParticipant) {
        this.server.to(meetingRoomId).emit('participant_joined', {
          participant: joiningParticipant
        });
      }

      this.logger.log(`User ${userId} joined meeting ${meetingRoomId}`);
    } catch (error) {
      this.logger.error(`Failed to join meeting ${meetingRoomId}: ${error.message}`);
      client.emit('error', {
        message: error?.message || 'Failed to join meeting'
      });
      client.leave(meetingRoomId);
    }
  }

  @SubscribeMessage('leave_meeting')
  async handleLeaveMeeting(
    @MessageBody() data: { meetingRoomId: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const meetingRoomId = data?.meetingRoomId;
    if (!meetingRoomId) {
      return;
    }

    client.leave(meetingRoomId);
    this.removeConnection(meetingRoomId, userId, client.id);
    this.socketMeta.delete(client.id);

    if (!this.isUserStillConnected(meetingRoomId, userId)) {
      this.server.to(meetingRoomId).emit('participant_left', {
        participantId: userId
      });
    }

    this.logger.log(`User ${userId} left meeting ${meetingRoomId}`);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { meetingRoomId: string; content: string },
    @ConnectedSocket() client: Socket
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const { meetingRoomId, content } = data;
    if (!meetingRoomId || !content?.trim()) {
      client.emit('error', { message: 'Invalid message payload' });
      return;
    }

    try {
      // Ensure the user belongs to the meeting
      const meeting = await this.meetingsService.getMeetingByRoomId(meetingRoomId);
      const meetingObject =
        meeting && typeof (meeting as any).toObject === 'function'
          ? (meeting as any).toObject()
          : meeting;

      const isParticipant =
        (meetingObject.participants ?? []).some((participant: any) => {
          const participantId =
            typeof participant === 'string'
              ? participant
              : participant?._id?.toString?.() || participant?.toString?.();
          return participantId === userId;
        }) ||
        (meetingObject.createdBy?._id?.toString?.() || meetingObject.createdBy?.toString?.()) ===
          userId;

      if (!isParticipant) {
        client.emit('error', { message: 'You are not part of this meeting' });
        return;
      }

      let user = meetingObject.participants?.find((participant: any) => {
        const participantId =
          typeof participant === 'string'
            ? participant
            : participant?._id?.toString?.() || participant?.toString?.();
        return participantId === userId;
      });

      if (!user) {
        user = await this.userModel
          .findById(userId)
          .select('firstName lastName email avatar picture')
          .lean();
      }

      const message: MeetingMessagePayload = {
        id: uuidv4(),
        meetingRoomId,
        userId,
        content: content.trim(),
        createdAt: new Date().toISOString(),
        user: {
          _id: userId,
          firstName: user?.firstName,
          lastName: user?.lastName,
          email: user?.email,
          avatar: user?.avatar,
          picture: user?.picture
        }
      };

      const messages = this.meetingMessages.get(meetingRoomId) || [];
      messages.push(message);
      // Keep only most recent 200 messages
      if (messages.length > 200) {
        messages.splice(0, messages.length - 200);
      }
      this.meetingMessages.set(meetingRoomId, messages);

      this.server.to(meetingRoomId).emit('meeting_message', message);
    } catch (error) {
      this.logger.error(`Failed to send meeting message: ${error.message}`);
      client.emit('error', {
        message: error?.message || 'Failed to send message'
      });
    }
  }

  private buildParticipantsPayload(
    meetingRoomId: string,
    participants: any[]
  ): MeetingParticipantPayload[] {
    const connections =
      this.meetingConnections.get(meetingRoomId) || new Map<string, Set<string>>();
    const payload: MeetingParticipantPayload[] = [];

    for (const participant of participants) {
      const participantId =
        typeof participant === 'string'
          ? participant
          : participant?._id?.toString?.() || participant?.toString?.();

      if (!participantId) {
        continue;
      }

      const participantObj = typeof participant === 'object' ? participant : {};
      payload.push({
        _id: participantId,
        firstName: participantObj.firstName,
        lastName: participantObj.lastName,
        email: participantObj.email,
        avatar: participantObj.avatar,
        picture: participantObj.picture,
        isConnected: connections.has(participantId)
      });
    }

    return payload;
  }

  private addConnection(meetingRoomId: string, userId: string, socketId: string) {
    if (!this.meetingConnections.has(meetingRoomId)) {
      this.meetingConnections.set(meetingRoomId, new Map<string, Set<string>>());
    }

    const roomConnections = this.meetingConnections.get(meetingRoomId)!;
    if (!roomConnections.has(userId)) {
      roomConnections.set(userId, new Set<string>());
    }

    roomConnections.get(userId)!.add(socketId);
  }

  private removeConnection(meetingRoomId: string, userId: string, socketId: string) {
    const roomConnections = this.meetingConnections.get(meetingRoomId);
    if (!roomConnections) {
      return;
    }

    const sockets = roomConnections.get(userId);
    if (!sockets) {
      return;
    }

    sockets.delete(socketId);
    if (sockets.size === 0) {
      roomConnections.delete(userId);
    }

    if (roomConnections.size === 0) {
      this.meetingConnections.delete(meetingRoomId);
    }
  }

  private isUserStillConnected(meetingRoomId: string, userId: string): boolean {
    const roomConnections = this.meetingConnections.get(meetingRoomId);
    if (!roomConnections) {
      return false;
    }

    const sockets = roomConnections.get(userId);
    return !!sockets && sockets.size > 0;
  }

  private extractTokenFromSocket(client: Socket): string | null {
    if (client.handshake.auth && client.handshake.auth.token) {
      return client.handshake.auth.token;
    }

    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const token = client.handshake.query.token as string;
    if (token) {
      return token;
    }

    return null;
  }
}
