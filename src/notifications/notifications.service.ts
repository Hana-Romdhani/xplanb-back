import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './notifications.schema';
import { CreateNotificationDto, UpdateNotificationDto } from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = new this.notificationModel(createNotificationDto);
    return notification.save();
  }

  async createForMultipleUsers(
    userIds: string[],
    title: string,
    message: string,
    type: NotificationType,
    metadata?: any
  ): Promise<any> {
    // Create notification documents using the model to ensure proper schema casting
    const notifications = userIds.map((userId) => {
      const notif = new this.notificationModel({
        recipient: userId,
        title,
        message,
        type,
        metadata
      });
      return notif;
    });

    // Save all notifications
    return Promise.all(notifications.map((n) => n.save()));
  }

  async findAll(userId: string): Promise<Notification[]> {
    return this.notificationModel
      .find({ recipient: userId })
      .sort({ createdAt: -1 })
      .populate('eventId')
      .populate('meetingId')
      .exec();
  }

  async findUnread(userId: string): Promise<Notification[]> {
    return this.notificationModel
      .find({ recipient: userId, read: false })
      .sort({ createdAt: -1 })
      .populate('eventId')
      .populate('meetingId')
      .exec();
  }

  async findOne(id: string, userId: string): Promise<Notification> {
    return this.notificationModel
      .findOne({ _id: id, recipient: userId })
      .populate('eventId')
      .populate('meetingId')
      .exec();
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    return this.notificationModel
      .findOneAndUpdate(
        { _id: id, recipient: userId },
        { read: true, readAt: new Date() },
        { new: true }
      )
      .exec();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel
      .updateMany({ recipient: userId, read: false }, { read: true, readAt: new Date() })
      .exec();
  }

  async update(
    id: string,
    updateNotificationDto: UpdateNotificationDto,
    userId: string
  ): Promise<Notification> {
    return this.notificationModel
      .findOneAndUpdate({ _id: id, recipient: userId }, updateNotificationDto, { new: true })
      .exec();
  }

  async delete(id: string, userId: string): Promise<Notification> {
    return this.notificationModel.findOneAndDelete({ _id: id, recipient: userId }).exec();
  }

  async deleteAll(userId: string): Promise<void> {
    await this.notificationModel.deleteMany({ recipient: userId }).exec();
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({ recipient: userId, read: false }).exec();
  }

  async findRecent(userId: string, limit: number = 10): Promise<Notification[]> {
    return this.notificationModel
      .find({ recipient: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('eventId')
      .populate('meetingId')
      .exec();
  }

  async findByType(userId: string, type: NotificationType): Promise<Notification[]> {
    return this.notificationModel
      .find({ recipient: userId, type })
      .sort({ createdAt: -1 })
      .populate('eventId')
      .populate('meetingId')
      .exec();
  }
}
