export class CreateNotificationDto {
  recipient: string;
  title: string;
  message: string;
  type: string;
  eventId?: string;
  meetingId?: string;
  metadata?: any;
}

export class UpdateNotificationDto {
  read?: boolean;
  readAt?: Date;
}
