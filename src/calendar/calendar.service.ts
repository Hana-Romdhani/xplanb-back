import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CalendarEvent, CalendarEventDocument } from './calendar.schema';
import { CreateCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notifications.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CalendarService {
  constructor(
    @InjectModel(CalendarEvent.name)
    private calendarEventModel: Model<CalendarEventDocument>,
    private notificationsService: NotificationsService
  ) {}

  async createEvent(
    createCalendarEventDto: CreateCalendarEventDto,
    userId: string
  ): Promise<CalendarEvent> {
    const event = new this.calendarEventModel({
      ...createCalendarEventDto,
      participants: createCalendarEventDto.participants || [],
      createdBy: userId,
      meetingRoomId: uuidv4()
    });

    const savedEvent = await event.save();

    // Create notifications for all participants
    if (createCalendarEventDto.participants && createCalendarEventDto.participants.length > 0) {
      const participantIds = createCalendarEventDto.participants.filter((id) => id !== userId);

      if (participantIds.length > 0) {
        await this.notificationsService.createForMultipleUsers(
          participantIds,
          'New Calendar Event',
          `You have been invited to "${createCalendarEventDto.title}"`,
          NotificationType.EVENT_CREATED,
          { eventId: savedEvent._id }
        );
      }
    }

    return savedEvent;
  }

  async findAll(userId: string, startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
    const query: any = {
      $or: [{ createdBy: userId }, { participants: userId }]
    };

    if (startDate && endDate) {
      query.startDate = {
        $gte: startDate,
        $lte: endDate
      };
    }

    return this.calendarEventModel
      .find(query)
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('linkedDocId', 'Title')
      .populate('linkedFolderId', 'Name')
      .sort({ startDate: 1 })
      .exec();
  }

  async findOne(id: string, userId: string): Promise<CalendarEvent> {
    return this.calendarEventModel
      .findOne({
        _id: id,
        $or: [{ createdBy: userId }, { participants: userId }]
      })
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('linkedDocId', 'Title')
      .populate('linkedFolderId', 'Name')
      .exec();
  }

  async updateEvent(
    id: string,
    updateCalendarEventDto: UpdateCalendarEventDto,
    userId: string
  ): Promise<CalendarEvent> {
    const updatedEvent = await this.calendarEventModel
      .findOneAndUpdate({ _id: id, createdBy: userId }, updateCalendarEventDto, { new: true })
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('linkedDocId', 'Title')
      .populate('linkedFolderId', 'Name')
      .exec();

    // Create notifications for participants about the update
    if (updatedEvent && updatedEvent.participants && updatedEvent.participants.length > 0) {
      const participantIds = updatedEvent.participants
        .map((p) => p._id?.toString?.() || p.toString())
        .filter((id) => id !== userId);

      if (participantIds.length > 0) {
        await this.notificationsService.createForMultipleUsers(
          participantIds,
          'Event Updated',
          `The event "${updatedEvent.title}" has been updated`,
          NotificationType.EVENT_UPDATED,
          { eventId: updatedEvent._id }
        );
      }
    }

    return updatedEvent;
  }

  async deleteEvent(id: string, userId: string): Promise<CalendarEvent> {
    const event = await this.calendarEventModel
      .findOneAndDelete({ _id: id, createdBy: userId })
      .populate('participants', 'firstName lastName email')
      .exec();

    // Create notifications for participants about the cancellation
    if (event && event.participants && event.participants.length > 0) {
      const participantIds = event.participants
        .map((p) => p._id?.toString?.() || p.toString())
        .filter((id) => id !== userId);

      if (participantIds.length > 0) {
        await this.notificationsService.createForMultipleUsers(
          participantIds,
          'Event Cancelled',
          `The event "${event.title}" has been cancelled`,
          NotificationType.EVENT_CANCELLED,
          { eventId: event._id }
        );
      }
    }

    return event;
  }

  async getUpcomingEvents(userId: string, limit: number = 10): Promise<CalendarEvent[]> {
    const now = new Date();

    return this.calendarEventModel
      .find({
        $or: [{ createdBy: userId }, { participants: userId }],
        startDate: { $gte: now },
        status: { $in: ['scheduled', 'in_progress'] }
      })
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('linkedDocId', 'Title')
      .populate('linkedFolderId', 'Name')
      .sort({ startDate: 1 })
      .limit(limit)
      .exec();
  }

  async getEventsByResource(
    resourceType: 'document' | 'folder',
    resourceId: string,
    userId: string
  ): Promise<CalendarEvent[]> {
    const query: any = {
      $or: [{ createdBy: userId }, { participants: userId }]
    };

    if (resourceType === 'document') {
      query.linkedDocId = resourceId;
    } else {
      query.linkedFolderId = resourceId;
    }

    return this.calendarEventModel
      .find(query)
      .populate('participants', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .sort({ startDate: 1 })
      .exec();
  }

  async getCalendarStats(userId: string): Promise<any> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [totalEvents, thisMonthEvents, upcomingEvents] = await Promise.all([
      this.calendarEventModel.countDocuments({
        $or: [{ createdBy: userId }, { participants: userId }]
      }),
      this.calendarEventModel.countDocuments({
        $or: [{ createdBy: userId }, { participants: userId }],
        startDate: {
          $gte: startOfMonth,
          $lte: endOfMonth
        }
      }),
      this.calendarEventModel.countDocuments({
        $or: [{ createdBy: userId }, { participants: userId }],
        startDate: { $gte: now },
        status: { $in: ['scheduled', 'in_progress'] }
      })
    ]);

    return {
      totalEvents,
      thisMonthEvents,
      upcomingEvents
    };
  }
}
