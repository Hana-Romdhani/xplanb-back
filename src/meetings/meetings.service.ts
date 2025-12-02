import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Meeting, MeetingDocument } from './schemas/meeting.schema';
import { Documents } from '../document/document.schema';
import { Folder } from '../folder/folder.schema';
import { User } from '../users/users.schema';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notifications.schema';
import { v4 as uuidv4 } from 'uuid';

export interface CreateMeetingDto {
  title: string;
  docId?: string;
  folderId?: string;
  participants: string[];
  startTime: Date;
  description?: string;
}

export interface UpdateMeetingDto {
  title?: string;
  endTime?: Date;
  transcript?: string;
  recordingUrl?: string;
  status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  duration?: number;
}

@Injectable()
export class MeetingsService {
  constructor(
    @InjectModel(Meeting.name) private meetingModel: Model<MeetingDocument>,
    @InjectModel(Documents.name) private documentsModel: Model<Documents>,
    @InjectModel(Folder.name) private folderModel: Model<Folder>,
    @InjectModel(User.name) private userModel: Model<User>,
    private emailService: EmailService,
    private notificationsService: NotificationsService
  ) {}

  async createMeeting(createMeetingDto: CreateMeetingDto, createdBy: string): Promise<Meeting> {
    const { docId, folderId, participants } = createMeetingDto;

    // Validate that either docId or folderId is provided, but not both
    // Allow standalone meetings without docId or folderId
    if (docId && folderId) {
      throw new BadRequestException('Cannot provide both docId and folderId');
    }

    // Validate document exists if docId is provided
    if (docId) {
      const document = await this.documentsModel.findById(docId).exec();
      if (!document) {
        throw new NotFoundException('Document not found');
      }
    }

    // Validate folder exists if folderId is provided (and it's a valid ObjectId)
    if (folderId) {
      // Check if folderId is a valid ObjectId before querying
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(folderId);
      if (isValidObjectId) {
        const folder = await this.folderModel.findById(folderId).exec();
        if (!folder) {
          throw new NotFoundException('Folder not found');
        }
      }
      // If folderId is not a valid ObjectId (like "standalone-meeting"), just skip validation
    }

    // Validate participants exist (only if provided)
    let participantUsers: User[] = [];
    if (participants && participants.length > 0) {
      participantUsers = await this.userModel
        .find({
          _id: { $in: participants }
        })
        .exec();

      if (participantUsers.length !== participants.length) {
        throw new BadRequestException('One or more participants not found');
      }
    }

    // Ensure creator is part of participants list (for presence/permissions)
    const participantSet = new Set<string>();
    if (participants && participants.length > 0) {
      for (const participant of participants) {
        participantSet.add(participant.toString());
      }
    }
    participantSet.add(createdBy.toString());

    // Generate unique meeting room ID
    const meetingRoomId = uuidv4();

    const meeting = new this.meetingModel({
      ...createMeetingDto,
      participants: Array.from(participantSet),
      createdBy,
      meetingRoomId,
      status: 'scheduled'
    });

    const savedMeeting = await meeting.save();

    // Add to participants' calendars
    await this.addToCalendars(savedMeeting, participantUsers);

    // Send notifications to participants
    if (participantUsers.length > 0) {
      await this.sendMeetingInvitationNotifications(savedMeeting, participantUsers, createdBy);
    }

    // Populate participants before returning (frontend will send emails)
    const populatedMeeting = await this.meetingModel
      .findById(savedMeeting._id)
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .exec();

    return populatedMeeting || savedMeeting;
  }

  async joinMeetingByRoomId(meetingRoomId: string, userId: string): Promise<Meeting> {
    if (!meetingRoomId) {
      throw new BadRequestException('Meeting room ID is required');
    }

    const meeting = await this.meetingModel.findOne({ meetingRoomId }).exec();

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (meeting.status === 'completed' || meeting.status === 'cancelled') {
      throw new BadRequestException('Meeting is no longer active');
    }

    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const participantIds = meeting.participants.map((p) => p.toString());
    const userIdString = user._id.toString();
    let shouldSave = false;
    let shouldNotify = false;

    if (!participantIds.includes(userIdString)) {
      meeting.participants.push(new Types.ObjectId(userIdString));
      shouldSave = true;
      shouldNotify = true;
    }

    if (meeting.status === 'scheduled') {
      meeting.status = 'in-progress';
      shouldSave = true;
    }

    if (shouldSave) {
      await meeting.save();
    }

    const populatedMeeting = await this.meetingModel
      .findById(meeting._id)
      .populate('participants', 'firstName lastName email avatar picture')
      .populate('createdBy', 'firstName lastName email avatar picture')
      .populate('docId', 'title')
      .populate('folderId', 'Name')
      .exec();

    if (!populatedMeeting) {
      throw new NotFoundException('Meeting not found after joining');
    }

    if (shouldNotify) {
      await this.notifyParticipantsOfJoin(populatedMeeting, user);
    }

    return populatedMeeting;
  }

  async getMeetingByRoomId(meetingRoomId: string): Promise<Meeting> {
    const meeting = await this.meetingModel
      .findOne({ meetingRoomId })
      .populate('participants', 'firstName lastName email avatar picture')
      .populate('createdBy', 'firstName lastName email avatar picture')
      .populate('docId', 'title')
      .populate('folderId', 'Name')
      .exec();

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    return meeting;
  }

  private async sendMeetingInvitationNotifications(
    meeting: Meeting,
    participants: User[],
    createdBy: string
  ): Promise<void> {
    try {
      // Get creator info
      const creator = await this.userModel.findById(createdBy);
      const creatorName = creator
        ? `${creator.firstName} ${creator.lastName}`
        : 'Meeting Organizer';

      // Generate meeting join URL
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const joinUrl = `${frontendUrl}/meet?room=${meeting.meetingRoomId}&title=${encodeURIComponent(meeting.title)}`;

      // Create notifications for each participant
      await this.notificationsService.createForMultipleUsers(
        participants.map((p) => p._id.toString()),
        'Meeting Invitation',
        `${creatorName} invited you to join "${meeting.title}". Click to join or copy the meeting link.`,
        NotificationType.MEETING_INVITATION,
        {
          meetingId: meeting._id.toString(),
          meetingRoomId: meeting.meetingRoomId,
          meetingTitle: meeting.title,
          createdBy: creatorName,
          startTime: meeting.startTime,
          joinUrl: joinUrl // Include join URL for easy access
        }
      );
    } catch (error) {
      console.error('Error sending meeting invitation notifications:', error);
      // Don't throw error - meeting should still be created even if notifications fail
    }
  }

  private async notifyParticipantsOfJoin(
    meeting: MeetingDocument,
    joiningUser: User
  ): Promise<void> {
    try {
      const recipients = new Set<string>();
      const joiningUserId = joiningUser._id?.toString?.() || '';

      const meetingParticipants: any[] = Array.isArray((meeting as any).participants)
        ? (meeting as any).participants
        : [];

      for (const participant of meetingParticipants) {
        const participantId =
          typeof participant === 'string'
            ? participant
            : participant?._id?.toString?.() || participant?.toString?.();

        if (participantId && participantId !== joiningUserId) {
          recipients.add(participantId);
        }
      }

      const creator = (meeting as any).createdBy;
      const creatorId = typeof creator === 'string' ? creator : creator?._id?.toString?.();

      if (creatorId && creatorId !== joiningUserId) {
        recipients.add(creatorId);
      }

      if (recipients.size === 0) {
        return;
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const joinUrl = meeting.meetingRoomId
        ? `${frontendUrl}/meet?room=${meeting.meetingRoomId}&title=${encodeURIComponent(meeting.title)}`
        : undefined;

      const joiningUserName =
        `${joiningUser.firstName ?? ''} ${joiningUser.lastName ?? ''}`.trim() ||
        joiningUser.email ||
        'A participant';

      await this.notificationsService.createForMultipleUsers(
        Array.from(recipients),
        'Meeting Update',
        `${joiningUserName} joined "${meeting.title}".`,
        NotificationType.MEETING_JOINED,
        {
          meetingId: meeting._id.toString(),
          meetingRoomId: meeting.meetingRoomId,
          meetingTitle: meeting.title,
          joinUrl,
          joiningUser: {
            _id: joiningUser._id?.toString?.(),
            firstName: joiningUser.firstName,
            lastName: joiningUser.lastName,
            email: joiningUser.email
          }
        }
      );
    } catch (error) {
      console.error('Error notifying participants about meeting join:', error);
    }
  }

  // Email sending is now handled by the frontend via Resend
  // This method is kept for potential future backend email sending if needed

  private async addToCalendars(meeting: Meeting, participants: User[]): Promise<void> {
    // This would integrate with your calendar service
    // For now, we'll just log that calendar events should be created
    console.log(`Calendar events should be created for meeting: ${meeting.title}`);
    console.log(`Participants: ${participants.map((p) => p.email).join(', ')}`);

    // TODO: Implement actual calendar integration
    // You can add calendar events here using your calendar service
  }

  async endMeeting(meetingId: string, updateData: UpdateMeetingDto): Promise<Meeting> {
    const meeting = await this.meetingModel.findById(meetingId).exec();

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (meeting.status === 'completed') {
      throw new BadRequestException('Meeting is already completed');
    }

    const endTime = updateData.endTime || new Date();
    const duration = meeting.startTime
      ? Math.round((endTime.getTime() - meeting.startTime.getTime()) / (1000 * 60))
      : updateData.duration;

    const updatedMeeting = await this.meetingModel
      .findByIdAndUpdate(
        meetingId,
        {
          ...updateData,
          endTime,
          duration,
          status: 'completed'
        },
        { new: true }
      )
      .exec();

    return updatedMeeting;
  }

  async getMeetingsByDocument(docId: string): Promise<Meeting[]> {
    return this.meetingModel
      .find({ docId })
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .sort({ startTime: -1 })
      .exec();
  }

  async getMeetingsByFolder(folderId: string): Promise<Meeting[]> {
    return this.meetingModel
      .find({ folderId })
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .sort({ startTime: -1 })
      .exec();
  }

  async updateMeetingTranscript(meetingId: string, transcript: string): Promise<Meeting> {
    const meeting = await this.meetingModel
      .findByIdAndUpdate(meetingId, { transcript }, { new: true })
      .exec();

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    return meeting;
  }

  async getMeetingById(meetingId: string): Promise<Meeting> {
    const meeting = await this.meetingModel
      .findById(meetingId)
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('docId', 'title')
      .populate('folderId', 'Name')
      .exec();

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    return meeting;
  }

  async getUserMeetings(userId: string, limit: number = 10): Promise<Meeting[]> {
    return this.meetingModel
      .find({
        $or: [{ participants: userId }, { createdBy: userId }]
      })
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('docId', 'title')
      .populate('folderId', 'Name')
      .sort({ startTime: -1 })
      .limit(limit)
      .exec();
  }

  async getUpcomingMeetings(userId: string): Promise<Meeting[]> {
    const now = new Date();
    return this.meetingModel
      .find({
        $or: [{ participants: userId }, { createdBy: userId }],
        startTime: { $gte: now },
        status: { $in: ['scheduled', 'in-progress'] }
      })
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('docId', 'title')
      .populate('folderId', 'Name')
      .sort({ startTime: 1 })
      .exec();
  }
}
